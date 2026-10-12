import { S3Client } from "@aws-sdk/client-s3";
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { S3_ROUTE_TIMEOUT_MS } from "@/lib/constants";
import {
   empty,
   errorXml,
   reply,
   s3Fixture,
   type FixtureHandle,
   type FixtureReply,
   type FixtureRequest,
} from "@/lib/testing/s3-fixture";
import { closeServer, listen } from "@/lib/testing/test-server";
import { UploadIdleError } from "./progress-floor";
import { isUploadTooLargeError } from "./stream-upload";

const streamed = vi.hoisted(() => ({ clients: [] as unknown[] }));

vi.mock("./stream-upload", async (original) => {
   const actual = await original<typeof import("./stream-upload")>();
   return {
      ...actual,
      streamThroughUpload: (
         params: Parameters<typeof actual.streamThroughUpload>[0]
      ) => {
         streamed.clients.push(params.client);
         return actual.streamThroughUpload(params);
      },
   };
});

const { transferObject } = await import("./transfer");

const SOURCE_KEY = "reports/q3.csv";
const DEST_KEY = "imported/q3.csv";
const ETAG = '"reviewed"';
const CONTENT = "key,value\n1,2\n";

const clientFor = (endpoint: string, handle: FixtureHandle, maxAttempts = 1) =>
   s3Fixture(handle, { endpoint, maxAttempts }).client;

const SOURCE_HEADERS = {
   etag: ETAG,
   "content-length": String(CONTENT.length),
   "content-type": "text/csv",
   "cache-control": "max-age=60",
   "content-disposition": 'attachment; filename="q3.csv"',
   "content-language": "en-GB",
   "content-encoding": "identity",
   expires: "Wed, 21 Oct 2026 07:28:00 GMT",
   "x-amz-meta-owner": "finance",
   "x-amz-website-redirect-location": "/new-page",
};

const sourceHandler =
   (body: () => Readable, contentLength = CONTENT.length) =>
   async (request: FixtureRequest): Promise<FixtureReply> =>
      request.method === "HEAD"
         ? empty(200, {
              ...SOURCE_HEADERS,
              "content-length": String(contentLength),
           })
         : reply(200, body(), {
              ...SOURCE_HEADERS,
              "content-length": String(contentLength),
           });

type Recorded = {
   requests: FixtureRequest[];
   handle: (r: FixtureRequest) => Promise<FixtureReply>;
};

const recording = (
   handle: (r: FixtureRequest) => Promise<FixtureReply>
): Recorded => {
   const requests: FixtureRequest[] = [];
   return {
      requests,
      handle: (request) => {
         requests.push(request);
         return handle(request);
      },
   };
};

const run = async ({
   destination,
   overwrite = false,
   body = () => Readable.from([CONTENT]),
   expectedETag = ETAG,
   maxBytes = 1024 * 1024,
   idleTimeoutMs,
   destinationAttempts,
   contentLength,
}: {
   destination: (r: FixtureRequest) => Promise<FixtureReply>;
   overwrite?: boolean;
   body?: () => Readable;
   expectedETag?: string | null;
   maxBytes?: number;
   idleTimeoutMs?: number;
   destinationAttempts?: number;
   contentLength?: number;
}) => {
   const from = recording(sourceHandler(body, contentLength));
   const to = recording(destination);
   const sourceClient = clientFor("https://source.example.com", from.handle);
   const destinationClient = clientFor(
      "https://dest.example.com",
      to.handle,
      destinationAttempts
   );
   const abortController = new AbortController();
   try {
      return {
         source: from.requests,
         destination: to.requests,
         result: await transferObject({
            source: {
               client: sourceClient,
               bucket: "from-bucket",
               key: SOURCE_KEY,
               expectedETag,
            },
            destination: {
               client: destinationClient,
               bucket: "to-bucket",
               key: DEST_KEY,
            },
            overwrite,
            maxBytes,
            partSize: 5 * 1024 * 1024,
            abortController,
            ...(idleTimeoutMs === undefined ? {} : { idleTimeoutMs }),
         }).catch((error: unknown) => error),
      };
   } finally {
      sourceClient.destroy();
      destinationClient.destroy();
   }
};

const emptyDestination = async (
   request: FixtureRequest
): Promise<FixtureReply> =>
   request.method === "HEAD" ? empty(404) : empty(200, { etag: '"written"' });

describe("streaming an object to another server", () => {
   it.each([
      ["single part", CONTENT.length, false],
      ["single part", CONTENT.length, true],
      ["multipart", 5 * 1024 * 1024 + 1, false],
      ["multipart", 5 * 1024 * 1024 + 1, true],
   ])(
      "rechecks %s publication (bytes: %s; destination occupied: %s)",
      async (_mode, size, occupied) => {
         let heads = 0;
         const { destination, result } = await run({
            body: () => Readable.from([Buffer.alloc(size)]),
            contentLength: size,
            maxBytes: 10 * 1024 * 1024,
            destination: async (request) => {
               if (request.method === "HEAD")
                  return ++heads === 2 && occupied
                     ? empty(200, { etag: '"other"' })
                     : empty(404);
               if (request.method === "POST")
                  return reply(
                     200,
                     Object.hasOwn(request.query, "uploads")
                        ? "<InitiateMultipartUploadResult><UploadId>u1</UploadId></InitiateMultipartUploadResult>"
                        : '<CompleteMultipartUploadResult><ETag>"written"</ETag></CompleteMultipartUploadResult>'
                  );
               return empty(request.method === "DELETE" ? 204 : 200, {
                  etag: '"written"',
               });
            },
         });
         expect(result).toMatchObject(
            occupied ? { status: 409 } : { size, eTag: '"written"' }
         );
         expect(heads).toBe(2);
         const publications = destination.filter(
            (request) =>
               (request.method === "PUT" && !request.query.partNumber) ||
               (request.method === "POST" && request.query.uploadId)
         );
         expect(publications).toHaveLength(occupied ? 0 : 1);
         if (!occupied) {
            expect(publications[0]?.headers["if-none-match"]).toBe("*");
            expect(destination.at(-2)?.method).toBe("HEAD");
         }
         expect(
            destination.filter((request) => request.method === "DELETE")
         ).toHaveLength(occupied && size > 5 * 1024 * 1024 ? 1 : 0);
      }
   );

   it("carries the stored headers and metadata onto the write", async () => {
      const { destination, result } = await run({
         destination: emptyDestination,
      });
      expect(result).toEqual({ size: CONTENT.length, eTag: '"written"' });
      const put = destination.find((r) => r.method === "PUT")!;
      expect(put.headers["content-type"]).toBe("text/csv");
      expect(put.headers["cache-control"]).toBe("max-age=60");
      expect(put.headers["content-disposition"]).toBe(
         'attachment; filename="q3.csv"'
      );
      expect(put.headers["content-language"]).toBe("en-GB");
      expect(put.headers["content-encoding"]).toBe("identity");
      expect(put.headers["expires"]).toBeDefined();
      expect(put.headers["x-amz-meta-owner"]).toBe("finance");
      expect(put.headers["x-amz-website-redirect-location"]).toBe("/new-page");
   });

   it("carries the redirect onto the initiation of a multipart transfer", async () => {
      const size = 5 * 1024 * 1024 + 1;
      const { destination, result } = await run({
         body: () => Readable.from([Buffer.alloc(size)]),
         contentLength: size,
         maxBytes: 10 * 1024 * 1024,
         destination: async (request) => {
            if (request.method === "HEAD") return empty(404);
            if (request.method === "POST")
               return reply(
                  200,
                  Object.hasOwn(request.query, "uploads")
                     ? "<InitiateMultipartUploadResult><UploadId>u1</UploadId></InitiateMultipartUploadResult>"
                     : '<CompleteMultipartUploadResult><ETag>"written"</ETag></CompleteMultipartUploadResult>'
               );
            return empty(200, { etag: '"written"' });
         },
      });
      expect(result).toMatchObject({ size, eTag: '"written"' });
      const initiation = destination.find((r) =>
         Object.hasOwn(r.query, "uploads")
      )!;
      expect(initiation.headers["x-amz-website-redirect-location"]).toBe(
         "/new-page"
      );
      expect(initiation.headers["content-type"]).toBe("text/csv");
   });

   it("uploads through a destination client that does not retry", async () => {
      streamed.clients.length = 0;
      await run({ destination: emptyDestination, destinationAttempts: 4 });
      const client = streamed.clients.at(-1) as S3Client;
      expect(await client.config.maxAttempts()).toBe(1);
   });

   it("pins the read to the reviewed version and guards a new destination", async () => {
      const { source, destination } = await run({
         destination: emptyDestination,
      });
      expect(source.find((r) => r.method === "HEAD")!.headers["if-match"]).toBe(
         ETAG
      );
      expect(source.find((r) => r.method === "GET")!.headers["if-match"]).toBe(
         ETAG
      );
      expect(
         destination.find((r) => r.method === "PUT")!.headers["if-none-match"]
      ).toBe("*");
   });

   it("replaces the live destination version when overwrite is on", async () => {
      const { destination, result } = await run({
         overwrite: true,
         destination: async (request) =>
            request.method === "HEAD"
               ? empty(200, { etag: '"old"', "content-length": "3" })
               : empty(200, { etag: '"written"' }),
      });
      expect(result).toMatchObject({ eTag: '"written"' });
      const put = destination.find((r) => r.method === "PUT")!;
      expect(put.headers["if-match"]).toBe('"old"');
      expect(put.headers).not.toHaveProperty("if-none-match");
   });

   it.each([
      ["was replaced", () => empty(200, { etag: '"newer"' })],
      ["was deleted", () => empty(404)],
   ])(
      "keeps an overwrite off a destination that %s while the object streamed",
      async (_name, later) => {
         let heads = 0;
         const { destination, result } = await run({
            overwrite: true,
            destination: async (request) =>
               request.method !== "HEAD"
                  ? empty(200, { etag: '"written"' })
                  : ++heads === 1
                    ? empty(200, { etag: '"old"', "content-length": "3" })
                    : later(),
         });
         expect(result).toMatchObject({
            status: 409,
            message: expect.stringContaining("destination changed"),
         });
         expect(heads).toBe(2);
         expect(destination.filter((r) => r.method === "PUT")).toEqual([]);
      }
   );

   it("re-reads an overwritten destination just before publishing over it", async () => {
      const { destination, result } = await run({
         overwrite: true,
         destination: async (request) =>
            request.method === "HEAD"
               ? empty(200, { etag: '"old"', "content-length": "3" })
               : empty(200, { etag: '"written"' }),
      });
      expect(result).toMatchObject({ eTag: '"written"' });
      expect(destination.map((r) => r.method)).toEqual(["HEAD", "HEAD", "PUT"]);
   });

   it("refuses an occupied destination before reading the object", async () => {
      const { source, destination, result } = await run({
         destination: async (request) =>
            request.method === "HEAD"
               ? empty(200, { etag: '"old"', "content-length": "3" })
               : empty(200, { etag: '"written"' }),
      });
      expect(result).toMatchObject({ status: 409 });
      expect(destination.filter((r) => r.method === "PUT")).toEqual([]);
      expect(source.filter((r) => r.method === "GET")).toEqual([]);
   });

   it("refuses a source that changed under the reviewed ETag", async () => {
      const from = recording(async () =>
         empty(200, { ...SOURCE_HEADERS, etag: '"other"' })
      );
      const sourceClient = clientFor("https://source.example.com", from.handle);
      const destinationClient = clientFor(
         "https://dest.example.com",
         emptyDestination
      );
      const result = await transferObject({
         source: {
            client: sourceClient,
            bucket: "from-bucket",
            key: SOURCE_KEY,
            expectedETag: ETAG,
         },
         destination: {
            client: destinationClient,
            bucket: "to-bucket",
            key: DEST_KEY,
         },
         overwrite: false,
         maxBytes: 1024,
         partSize: 5 * 1024 * 1024,
         abortController: new AbortController(),
      }).catch((error: unknown) => error);
      sourceClient.destroy();
      destinationClient.destroy();
      expect(result).toMatchObject({ status: 409 });
   });

   it("surfaces a destination HEAD that failed instead of assuming it is free", async () => {
      const { destination, result } = await run({
         overwrite: true,
         destination: async (request) =>
            request.method === "HEAD"
               ? reply(500, errorXml("InternalError"))
               : empty(200, { etag: '"written"' }),
      });
      expect(result).toMatchObject({ status: 502 });
      expect(destination.filter((r) => r.method === "PUT")).toEqual([]);
   });

   it("refuses an object larger than the instance allows", async () => {
      const { destination, result } = await run({
         destination: emptyDestination,
         maxBytes: 2,
      });
      expect(result).toMatchObject({ status: 413 });
      expect(destination.filter((r) => r.method === "PUT")).toEqual([]);
   });
});

describe("the read has to clear the floor rate", () => {
   const paced = (everyMs: number, chunks: number, bytes: number): Readable => {
      const body = new Readable({ read() {} });
      let sent = 0;
      const timer = setInterval(() => {
         if (sent++ >= chunks) {
            clearInterval(timer);
            body.push(null);
            return;
         }
         body.push(Buffer.alloc(bytes, 1));
      }, everyMs);
      body.on("close", () => clearInterval(timer));
      return body;
   };

   it("gives up on a source that trickles under the floor", async () => {
      const body = paced(10, 40, 1);
      const { result } = await run({
         destination: emptyDestination,
         body: () => body,
         idleTimeoutMs: 40,
      });
      body.destroy();
      expect(result).toBeInstanceOf(UploadIdleError);
   });

   it("leaves a source reading above the floor alone", async () => {
      const body = paced(15, 8, 8 * 1024);
      const { result } = await run({
         destination: emptyDestination,
         body: () => body,
         idleTimeoutMs: 40,
      });
      expect(result).toEqual({ size: 64 * 1024, eTag: '"written"' });
   });

   it("lets a short body end inside a window it never fills", async () => {
      const body = new Readable({ read() {} });
      const timer = setTimeout(() => {
         body.push(Buffer.from("hi"));
         body.push(null);
      }, 20);
      const { result } = await run({
         destination: emptyDestination,
         body: () => body,
         idleTimeoutMs: 40,
      });
      clearTimeout(timer);
      expect(result).toEqual({ size: 2, eTag: '"written"' });
   });

   it("does not charge the source for a window spent under backpressure", async () => {
      const body = new Readable({ read() {} });
      body.push(Buffer.from("hi"));
      body.once("resume", () => {
         setTimeout(() => body.pause(), 5);
         setTimeout(() => {
            body.resume();
            body.push(null);
         }, 150);
      });
      const { result } = await run({
         destination: emptyDestination,
         body: () => body,
         idleTimeoutMs: 40,
      });
      expect(result).toEqual({ size: 2, eTag: '"written"' });
   });
});

describe("a disconnected client stops the transfer", () => {
   it("destroys the source body and fails the write", async () => {
      const stalled = new Readable({ read() {} });
      stalled.push(Buffer.from("partial"));
      const { promise: started, resolve: sawGet } =
         Promise.withResolvers<void>();
      const sourceClient = clientFor(
         "https://source.example.com",
         async (request) => {
            if (request.method === "HEAD") return empty(200, SOURCE_HEADERS);
            sawGet();
            return reply(200, stalled, SOURCE_HEADERS);
         }
      );
      const destinationClient = clientFor(
         "https://dest.example.com",
         emptyDestination
      );
      const abortController = new AbortController();
      const transfer = transferObject({
         source: {
            client: sourceClient,
            bucket: "from-bucket",
            key: SOURCE_KEY,
            expectedETag: ETAG,
         },
         destination: {
            client: destinationClient,
            bucket: "to-bucket",
            key: DEST_KEY,
         },
         overwrite: false,
         maxBytes: 1024 * 1024,
         partSize: 5 * 1024 * 1024,
         abortController,
      }).catch((error: unknown) => error);
      await started;
      abortController.abort();
      const result = await transfer;
      expect(result).toBeInstanceOf(Error);
      expect(stalled.destroyed).toBe(true);
      sourceClient.destroy();
      destinationClient.destroy();
   });
});

describe("the transfer closes its source after a destination failure", () => {
   const chunk = Buffer.alloc(64 * 1024);
   const chunks = 1024;

   const finiteSource = () => {
      let sent = 0;
      const body = new Readable({
         read() {
            this.push(sent++ < chunks ? chunk : null);
         },
         destroy(_error, done) {
            setImmediate(() => done(new Error("Source socket closed")));
         },
      });
      const closed = new Promise<void>((resolve) =>
         body.once("close", resolve)
      );
      return { body, closed, sent: () => sent };
   };

   const failingDestination =
      (failure: "initiation" | "part") =>
      async (request: FixtureRequest): Promise<FixtureReply> => {
         if (request.method === "HEAD") return empty(404);
         if (request.method === "DELETE") return empty(204);
         if (request.method === "POST" && failure === "part")
            return reply(
               200,
               "<InitiateMultipartUploadResult><UploadId>upload</UploadId></InitiateMultipartUploadResult>"
            );
         return reply(500, errorXml("InternalError"));
      };

   it.each(["initiation", "part"] as const)(
      "closes an unfinished finite source after %s fails",
      async (failure) => {
         const source = finiteSource();
         const { result, destination } = await run({
            body: () => source.body,
            maxBytes: chunks * chunk.length,
            destination: failingDestination(failure),
         });
         expect(result).toMatchObject({ status: 502 });
         expect(source.body.destroyed).toBe(true);
         await source.closed;
         expect(source.sent()).toBeLessThan(chunks);
         expect(source.body.listenerCount("error")).toBe(0);
         expect(
            destination.some(
               (request) => request.method === "PUT" && request.query.partNumber
            )
         ).toBe(failure === "part");
         expect(
            destination.some((request) => request.method === "DELETE")
         ).toBe(failure === "part");
         expect(
            destination.some(
               (request) => request.method === "POST" && request.query.uploadId
            )
         ).toBe(false);
      }
   );

   it("closes an unfinished finite source after it exceeds the byte limit", async () => {
      const source = finiteSource();
      const { result, destination } = await run({
         body: () => source.body,
         maxBytes: CONTENT.length,
         destination: emptyDestination,
      });
      expect(result).toSatisfy(isUploadTooLargeError);
      expect(source.body.destroyed).toBe(true);
      await source.closed;
      expect(source.sent()).toBeLessThan(chunks);
      expect(source.body.listenerCount("error")).toBe(0);
      expect(
         destination.filter((request) => request.method !== "HEAD")
      ).toEqual([]);
   });

   it("closes the HTTP response socket when multipart initiation fails", async () => {
      const length = chunks * chunk.length;
      let sourceClosed = false;
      let sourceFinished = false;
      const { server, origin } = await listen((request, response) => {
         response.writeHead(200, {
            ...SOURCE_HEADERS,
            "content-length": String(length),
         });
         if (request.method === "HEAD") {
            response.end();
            return;
         }
         let sent = 0;
         const timer = setInterval(() => {
            if (response.writableNeedDrain) return;
            response.write(chunk);
            if (++sent === chunks) {
               clearInterval(timer);
               response.end();
            }
         }, 1);
         response.once("close", () => {
            clearInterval(timer);
            sourceClosed = true;
            sourceFinished = response.writableFinished;
         });
      });
      const sourceClient = new S3Client({
         endpoint: origin,
         region: "us-east-1",
         forcePathStyle: true,
         maxAttempts: 1,
         credentials: { accessKeyId: "test", secretAccessKey: "test" },
      });
      const destinationClient = clientFor(
         "https://dest.example.com",
         failingDestination("initiation")
      );
      try {
         const result = await transferObject({
            source: {
               client: sourceClient,
               bucket: "from-bucket",
               key: SOURCE_KEY,
               expectedETag: ETAG,
            },
            destination: {
               client: destinationClient,
               bucket: "to-bucket",
               key: DEST_KEY,
            },
            overwrite: false,
            maxBytes: length,
            partSize: 5 * 1024 * 1024,
            abortController: new AbortController(),
         }).catch((error: unknown) => error);
         expect(result).toMatchObject({ status: 502 });
         await expect.poll(() => sourceClosed).toBe(true);
         expect(sourceFinished).toBe(false);
      } finally {
         sourceClient.destroy();
         destinationClient.destroy();
         await closeServer(server);
      }
   });
});

describe("the streamed bytes are bounded, not just the declared length", () => {
   it("stops a source that streams past the cap its HEAD promised to fit", async () => {
      const understated = { ...SOURCE_HEADERS, "content-length": "2" };
      const sourceClient = clientFor(
         "https://source.example.com",
         async (request) =>
            request.method === "HEAD"
               ? empty(200, understated)
               : reply(200, CONTENT, understated)
      );
      const to = recording(emptyDestination);
      const destinationClient = clientFor(
         "https://dest.example.com",
         to.handle
      );
      const result = await transferObject({
         source: {
            client: sourceClient,
            bucket: "from-bucket",
            key: SOURCE_KEY,
            expectedETag: ETAG,
         },
         destination: {
            client: destinationClient,
            bucket: "to-bucket",
            key: DEST_KEY,
         },
         overwrite: false,
         maxBytes: 4,
         partSize: 5 * 1024 * 1024,
         abortController: new AbortController(),
      }).catch((error: unknown) => error);
      sourceClient.destroy();
      destinationClient.destroy();
      expect(result).toSatisfy(isUploadTooLargeError);
      expect(to.requests.filter((r) => r.method === "PUT")).toEqual([]);
   });
});

describe("streaming exact slash-ending objects", () => {
   it.each(["", "stored data"])(
      "preserves body and metadata for %j",
      async (body) => {
         const requests: FixtureRequest[] = [];
         const sourceClient = clientFor(
            "https://source.example.com",
            async (request) => {
               expect(decodeURIComponent(request.path)).toBe(
                  "/from-bucket/raw/data/"
               );
               expect(request.headers["if-match"]).toBe(ETAG);
               return sourceHandler(
                  () => Readable.from([body]),
                  Buffer.byteLength(body)
               )(request);
            }
         );
         const destinationClient = clientFor(
            "https://dest.example.com",
            async (request) => {
               requests.push(request);
               expect(decodeURIComponent(request.path)).toBe(
                  "/to-bucket/copied/data/"
               );
               if (request.method === "HEAD") return empty(404);
               expect(request.method).toBe("PUT");
               expect(request.headers["if-none-match"]).toBe("*");
               expect(request.headers["x-amz-meta-owner"]).toBe("finance");
               expect(request.headers["content-type"]).toBe("text/csv");
               expect(
                  Buffer.from(
                     (request as FixtureRequest & { body: Uint8Array }).body
                  ).toString()
               ).toBe(body);
               return empty(200, { etag: '"copied"' });
            }
         );
         try {
            expect(
               await transferObject({
                  source: {
                     client: sourceClient,
                     bucket: "from-bucket",
                     key: "raw/data/",
                     expectedETag: ETAG,
                  },
                  destination: {
                     client: destinationClient,
                     bucket: "to-bucket",
                     key: "copied/data/",
                  },
                  overwrite: false,
                  maxBytes: 1024,
                  partSize: 5 * 1024 * 1024,
                  abortController: new AbortController(),
               })
            ).toEqual({ size: Buffer.byteLength(body), eTag: '"copied"' });
            expect(
               requests.filter((request) => request.method === "PUT")
            ).toHaveLength(1);
         } finally {
            sourceClient.destroy();
            destinationClient.destroy();
         }
      }
   );
});

describe("the requests before the stream have their own deadline", () => {
   const silent = (
      _request: FixtureRequest,
      options: { abortSignal?: AbortSignal }
   ) =>
      new Promise<FixtureReply>((_resolve, reject) => {
         const signal = options.abortSignal!;
         const abort = () =>
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
         if (signal.aborted) abort();
         else signal.addEventListener("abort", abort, { once: true });
      });

   const transfer = (
      source: (
         request: FixtureRequest,
         options: { abortSignal?: AbortSignal }
      ) => Promise<FixtureReply>,
      destination: (
         request: FixtureRequest,
         options: { abortSignal?: AbortSignal }
      ) => Promise<FixtureReply>
   ) => {
      const sourceClient = clientFor("https://source.example.com", source);
      const destinationClient = clientFor(
         "https://dest.example.com",
         destination
      );
      const abortController = new AbortController();
      const pending = transferObject({
         source: {
            client: sourceClient,
            bucket: "from-bucket",
            key: SOURCE_KEY,
            expectedETag: ETAG,
         },
         destination: {
            client: destinationClient,
            bucket: "to-bucket",
            key: DEST_KEY,
         },
         overwrite: false,
         maxBytes: 64 * 1024 * 1024,
         partSize: 5 * 1024 * 1024,
         abortController,
      }).finally(() => {
         sourceClient.destroy();
         destinationClient.destroy();
      });
      return { abortController, pending };
   };

   const answered = sourceHandler(() => Readable.from([CONTENT]));

   it.each([
      ["the source HEAD", silent, emptyDestination],
      ["the destination HEAD", answered, silent],
      [
         "the source GET",
         (request: FixtureRequest, options: { abortSignal?: AbortSignal }) =>
            request.method === "HEAD"
               ? answered(request)
               : silent(request, options),
         emptyDestination,
      ],
   ])(
      "stops waiting for %s without cancelling the caller",
      async (_name, source, destination) => {
         vi.useFakeTimers();
         try {
            const { abortController, pending } = transfer(source, destination);
            const settled = vi.fn();
            pending.catch(settled);
            await vi.advanceTimersByTimeAsync(S3_ROUTE_TIMEOUT_MS - 1);
            expect(settled).not.toHaveBeenCalled();
            await vi.advanceTimersByTimeAsync(1);
            await expect(pending).rejects.toMatchObject({ status: 502 });
            expect(abortController.signal.aborted).toBe(false);
            expect(vi.getTimerCount()).toBe(0);
         } finally {
            vi.useRealTimers();
         }
      }
   );

   it("leaves a stream that outlasts the deadline alone", async () => {
      vi.useFakeTimers();
      try {
         const chunk = Buffer.alloc(1024 * 1024, 1);
         const body = new Readable({ read() {} });
         let getSignal: AbortSignal | undefined;
         const { pending } = transfer(async (request, options) => {
            if (request.method === "GET") getSignal = options.abortSignal;
            return sourceHandler(() => body, 4 * chunk.length)(request);
         }, emptyDestination);
         for (let sent = 0; sent < 4; sent++) {
            await vi.advanceTimersByTimeAsync(S3_ROUTE_TIMEOUT_MS / 2);
            body.push(chunk);
         }
         body.push(null);
         await vi.advanceTimersByTimeAsync(1);
         await expect(pending).resolves.toMatchObject({
            size: 4 * chunk.length,
            eTag: '"written"',
         });
         expect(getSignal?.aborted).toBe(false);
         expect(vi.getTimerCount()).toBe(0);
      } finally {
         vi.useRealTimers();
      }
   });
});
