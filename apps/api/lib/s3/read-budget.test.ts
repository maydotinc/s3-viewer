import { ListObjectsV2Command, type S3Client } from "@aws-sdk/client-s3";
import { GIB, MIB, Provider } from "@s3-viewer/types";
import { Readable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fakeResponse } from "@/lib/testing/fake-response";
import {
   AWS_ENDPOINT,
   reply,
   s3Fixture,
   type FixtureHandle,
   type FixtureRequest,
} from "@/lib/testing/s3-fixture";
import { collectArchiveEntries } from "./archive/entries";
import { listBuckets, probeBucketList } from "./bucket-listing";
import {
   bufferedBodyReservationBytes,
   bufferedBodyRetainedBytes,
} from "./buffered-body";
import { copyObject, MIN_COPY_PART_BYTES } from "./copy";
import { existingKeys, listKeysPage, listPage } from "./listing";
import {
   createReadBudget,
   retainedRead,
   withReadResponse,
   withReadUser,
} from "./read-budget";
import { installReadBudget } from "./read-budget.fixture";
import { withRequestBudget } from "./request-budget";
import {
   cappedStreamCollector,
   withBufferedResponses,
} from "./response-collector";
import { estimateXmlMemory } from "./xml-response-guard";

const limits = {
   maxBytes: 32,
   maxUserBytes: 16,
   maxServerBytes: 24,
   maxReads: 4,
   maxUserReads: 2,
   maxServerReads: 3,
};

const THREE_READS = { total: 3, user: 3, server: 3 };
const CUSTOM_ENDPOINT = "https://storage.example.com";

const budgetedClient = (
   handle: FixtureHandle,
   serverId: string,
   endpoint = CUSTOM_ENDPOINT
) =>
   withRequestBudget(
      s3Fixture(handle, { endpoint, maxAttempts: 1 }).client,
      serverId
   );

const pageClient = (page: () => string, serverId: string, endpoint?: string) =>
   budgetedClient(async () => reply(200, page()), serverId, endpoint);

afterEach(() => vi.restoreAllMocks());

describe("buffered storage read budget", () => {
   it("accounts for retained bytes globally and releases reservations exactly once", () => {
      const budget = createReadBudget(limits);
      const first = budget.acquire({ userId: "a", serverId: "one" });
      const second = budget.acquire({ userId: "b", serverId: "two" });
      const third = budget.acquire({ userId: "c", serverId: "three" });
      first.retain(16);
      second.retain(16);
      expect(() => third.retain(1)).toThrow(/capacity is busy/);
      first.release();
      first.release();
      third.retain(16);
      expect(() => third.retain(1)).toThrow(/capacity is busy/);
      second.release();
      third.release();
      const next = budget.acquire({ userId: "a", serverId: "one" });
      next.retain(16);
      next.release();
   });

   it("limits one user across servers and one server across users", () => {
      const budget = createReadBudget({ ...limits, maxBytes: 100 });
      const first = budget.acquire({ userId: "a", serverId: "one" });
      const sameUser = budget.acquire({ userId: "a", serverId: "two" });
      const sameServer = budget.acquire({ userId: "b", serverId: "one" });
      first.retain(16);
      expect(() => sameUser.retain(1)).toThrow(/capacity is busy/);
      sameServer.retain(8);
      expect(() => sameServer.retain(1)).toThrow(/capacity is busy/);
      first.release();
      sameUser.retain(16);
      sameServer.retain(8);
      sameUser.release();
      sameServer.release();
   });

   it("bounds even empty reads globally, per user and per server", () => {
      const budget = createReadBudget(limits);
      const a = budget.acquire({ userId: "a", serverId: "one" });
      const b = budget.acquire({ userId: "a", serverId: "two" });
      expect(() => budget.acquire({ userId: "a", serverId: "three" })).toThrow(
         /capacity/
      );
      const c = budget.acquire({ userId: "b", serverId: "one" });
      const d = budget.acquire({ userId: "c", serverId: "one" });
      expect(() => budget.acquire({ userId: "d", serverId: "four" })).toThrow(
         /capacity/
      );
      b.release();
      expect(() => budget.acquire({ userId: "d", serverId: "one" })).toThrow(
         /capacity/
      );
      a.release();
      c.release();
      d.release();
      budget.acquire({ userId: "a", serverId: "one" }).release();
   });

   it("inherits the authenticated user through asynchronous work without mixing users", async () => {
      const budget = createReadBudget(limits);
      await Promise.all(
         ["a", "b"].map((userId) =>
            withReadUser(userId, async () => {
               await Promise.resolve();
               const held = budget.acquire({ serverId: userId });
               held.retain(16);
               await Promise.resolve();
               const next = budget.acquire({ serverId: `${userId}-other` });
               expect(() => next.retain(1)).toThrow(/capacity/);
               next.release();
               held.release();
            })
         )
      );
   });

   it("does not remove newer scope accounting when an empty reservation is released", () => {
      const budget = createReadBudget(limits);
      const empty = budget.acquire({ userId: "a", serverId: "one" });
      empty.finishRead();
      const first = budget.acquire({ userId: "a", serverId: "one" });
      first.retain(16);
      empty.release();
      const next = budget.acquire({ userId: "a", serverId: "two" });
      expect(() => next.retain(1)).toThrow(/capacity/);
      next.release();
      first.release();
   });
});

describe("retainedRead", () => {
   it("keeps what a read retained until the response ends", async () => {
      const budget = installReadBudget(16);
      const res = fakeResponse();
      const result = await withReadResponse("a", res, () =>
         retainedRead("one", async (reservation) => {
            reservation.retain(16);
            return "kept";
         })
      );
      expect(result).toBe("kept");
      const next = budget.acquire({ userId: "a", serverId: "two" });
      expect(() => next.retain(1)).toThrow(/capacity/);
      res.emit("finish");
      next.retain(16);
      next.release();
   });

   it("releases the reservation when the read fails", async () => {
      const budget = installReadBudget(16);
      const res = fakeResponse();
      await expect(
         withReadResponse("a", res, () =>
            retainedRead(undefined, async (reservation) => {
               reservation.retain(16);
               throw new Error("listing failed");
            })
         )
      ).rejects.toThrow("listing failed");
      const next = budget.acquire({ userId: "a", serverId: "unscoped" });
      next.retain(16);
      next.release();
   });
});

describe("buffered bucket listing", () => {
   const serverId = "bucket-server";
   const bucketClient = (page: () => string) =>
      pageClient(page, serverId, AWS_ENDPOINT);

   it("releases the permission probe page before the application response finishes", async () => {
      const budget = installReadBudget(1_000_000, THREE_READS);
      const page = vi.fn(
         () =>
            "<ListAllMyBucketsResult><Buckets><Bucket><Name>first</Name></Bucket></Buckets><ContinuationToken>next</ContinuationToken></ListAllMyBucketsResult>"
      );
      const client = bucketClient(page);
      const response = fakeResponse();
      try {
         await withReadResponse("alice", response, () =>
            probeBucketList(client, new AbortController().signal)
         );
         expect(page).toHaveBeenCalledOnce();
         const probe = budget.acquire({ serverId, userId: "alice" });
         try {
            probe.retain(1_000_000);
         } finally {
            probe.release();
         }
      } finally {
         response.emit("finish");
         client.destroy();
      }
   });

   it.each(["finish", "pagination failure"])(
      "releases compact bucket records after %s",
      async (event) => {
         const budget = installReadBudget(1_000_000, THREE_READS);
         const client = bucketClient(
            () =>
               `<ListAllMyBucketsResult><Buckets><Bucket><Name><![CDATA[bucket-name]]></Name></Bucket></Buckets>${event === "pagination failure" ? "<ContinuationToken>same</ContinuationToken>" : ""}</ListAllMyBucketsResult>`
         );
         const response = fakeResponse();
         try {
            const pending = withReadResponse("alice", response, () =>
               listBuckets(client, new AbortController().signal)
            );
            if (event === "pagination failure")
               await expect(pending).rejects.toMatchObject({ status: 502 });
            else expect(await pending).toMatchObject([{ Name: "bucket-name" }]);
            const probe = budget.acquire({ serverId, userId: "alice" });
            try {
               if (event !== "pagination failure") {
                  probe.retain(999_000);
                  expect(() => probe.retain(1_000)).toThrow(/capacity/);
                  response.emit(event);
                  probe.retain(1_000);
               } else probe.retain(1_000_000);
            } finally {
               probe.release();
            }
         } finally {
            response.emit("finish");
            client.destroy();
         }
      }
   );
});

describe("buffered copy response lifetimes", () => {
   const serverId = "buffered-copy";
   const userId = "copy-user";
   const owner = "a".repeat(64);
   const uploadId = "upload-%41-中";
   const resultETag = '"complete-%41-😀"';
   const partETag = (part: number) => `"part-${part}-%41-😀"`;
   const acl = `<AccessControlPolicy><Owner><ID><![CDATA[${owner}]]></ID></Owner><AccessControlList><Grant><Grantee xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="CanonicalUser"><ID><![CDATA[${owner}]]></ID></Grantee><Permission>FULL_CONTROL</Permission></Grant></AccessControlList></AccessControlPolicy>`;
   const tagging =
      "<Tagging><TagSet><Tag><Key><![CDATA[a&b]]></Key><Value><![CDATA[中 %41]]></Value></Tag></TagSet></Tagging>";
   const initiation = `<InitiateMultipartUploadResult><UploadId><![CDATA[${uploadId}]]></UploadId></InitiateMultipartUploadResult>`;
   const completed = `<CompleteMultipartUploadResult><ETag><![CDATA[${resultETag}]]></ETag></CompleteMultipartUploadResult>`;
   const copied = `<CopyObjectResult><ETag><![CDATA[${resultETag}]]></ETag></CopyObjectResult>`;
   const part = (number: number) =>
      `<CopyPartResult><ETag><![CDATA[${partETag(number)}]]></ETag></CopyPartResult>`;

   type Handler = (
      request: FixtureRequest,
      options: { abortSignal?: AbortSignal }
   ) => Promise<string | undefined>;

   const copyClient = (handle: Handler) => {
      const client = budgetedClient(
         async (request, options) => {
            const body = await handle(request, options);
            return reply(request.method === "DELETE" ? 204 : 200, body ?? "");
         },
         serverId,
         AWS_ENDPOINT
      );
      client.middlewareStack.remove("requestBudget");
      return client;
   };

   const copy = (
      client: ReturnType<typeof copyClient>,
      size: number,
      signal?: AbortSignal
   ) =>
      copyObject({ client, bucket: "bucket", signal }, Provider.S3, {
         sourceKey: "source",
         destinationKey: "destination",
         source: { ETag: '"reviewed"', ContentLength: size, $metadata: {} },
         sourceETag: '"reviewed"',
      });

   const standardReply = (request: FixtureRequest): string | undefined => {
      if (request.method === "DELETE") return undefined;
      if ("acl" in request.query) return acl;
      if ("tagging" in request.query) return tagging;
      if ("uploads" in request.query) return initiation;
      if (request.query.partNumber)
         return part(Number(request.query.partNumber));
      if ("uploadId" in request.query) return completed;
      return copied;
   };

   it("keeps parts through completion and only the result ETag until the HTTP response finishes", async () => {
      const maxBytes = 4 * MIB;
      const budget = installReadBudget(maxBytes);
      const completing = Promise.withResolvers<void>();
      const releaseCompletion = Promise.withResolvers<void>();
      let initiationHeaders: Record<string, string> = {};
      const client = copyClient(async (request) => {
         if ("uploads" in request.query) initiationHeaders = request.headers;
         if (request.method === "POST" && "uploadId" in request.query) {
            completing.resolve();
            await releaseCompletion.promise;
         }
         return standardReply(request);
      });
      const response = fakeResponse();
      const pending = withReadResponse(userId, response, () =>
         copy(client, 300 * MIN_COPY_PART_BYTES)
      );
      try {
         await Promise.race([completing.promise, pending]);
         const during = budget.acquire({ serverId, userId });
         try {
            expect(() => during.retain(maxBytes - 1024)).toThrow(/capacity/);
         } finally {
            during.release();
         }
         releaseCompletion.resolve();
         await expect(pending).resolves.toEqual({
            eTag: resultETag,
            size: 300 * MIN_COPY_PART_BYTES,
         });
         expect(initiationHeaders["x-amz-grant-full-control"]).toBe(
            `id="${owner}"`
         );
         expect(initiationHeaders["x-amz-tagging"]).toBe(
            "a%26b=%E4%B8%AD%20%2541"
         );
         const after = budget.acquire({ serverId, userId });
         try {
            after.retain(maxBytes - 1024);
            expect(() => after.retain(1024)).toThrow(/capacity/);
            response.emit("finish");
            after.retain(1024);
         } finally {
            after.release();
         }
      } finally {
         releaseCompletion.resolve();
         await pending.catch(() => undefined);
         response.emit("finish");
         client.destroy();
      }
   });

   it.each(["missing ETag", "cancelled"])(
      "cleans up the upload and releases consumed data after a %s failure",
      async (failure) => {
         const maxBytes = 4 * MIB;
         const budget = installReadBudget(maxBytes);
         const controller = new AbortController();
         let aborts = 0;
         let completions = 0;
         const client = copyClient(async (request, options) => {
            if (request.method === "DELETE") {
               aborts++;
               expect(request.query.uploadId).toBe(uploadId);
               expect(options.abortSignal?.aborted).toBe(false);
               expect(options.abortSignal).not.toBe(controller.signal);
            } else if (request.query.partNumber === "1") {
               if (failure === "cancelled") controller.abort();
               else return "<CopyPartResult/>";
            } else if (request.method === "POST" && "uploadId" in request.query)
               completions++;
            return standardReply(request);
         });
         const response = fakeResponse();
         try {
            await expect(
               withReadResponse(userId, response, () =>
                  copy(client, 6 * GIB, controller.signal)
               )
            ).rejects.toThrow();
            expect(aborts).toBe(1);
            expect(completions).toBe(0);
            const probe = budget.acquire({ serverId, userId });
            try {
               probe.retain(maxBytes);
            } finally {
               probe.release();
            }
         } finally {
            response.emit("finish");
            client.destroy();
         }
      }
   );
});

describe("SDK buffered response admission", () => {
   const xml =
      "<ListBucketResult><Contents><Key>file</Key></Contents></ListBucketResult>";
   const bytes = Buffer.from(xml);
   // S3's 200-error middleware collects and replays the body before parsing it, so
   // a budget this size admits exactly one listing and refuses a second body.
   const retainedBodyBytes =
      bufferedBodyRetainedBytes(bytes.length) + estimateXmlMemory(bytes);
   const installBudget = (
      maxBytes = retainedBodyBytes +
         Math.max(bufferedBodyReservationBytes(bytes.length), retainedBodyBytes)
   ) => installReadBudget(maxBytes, { total: 64, user: 16, server: 32 });
   const bufferedClient = (page: () => string = () => xml) =>
      withBufferedResponses(
         s3Fixture(async () => reply(200, page()), {
            endpoint: CUSTOM_ENDPOINT,
            maxAttempts: 1,
         }).client,
         "server"
      );
   const list = (client: S3Client) =>
      client.send(new ListObjectsV2Command({ Bucket: "bucket" }));

   it("preserves retained CDATA keys and ETags when encoding is absent", async () => {
      const key = "literal-%41-😀.txt";
      const etag = '"literal-%41-etag"';
      const client = bufferedClient(
         () =>
            `<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key><![CDATA[${key}]]></Key><ETag><![CDATA[${etag}]]></ETag></Contents></ListBucketResult>`
      );
      const response = fakeResponse();
      try {
         const result = await withReadResponse("alice", response, () =>
            existingKeys({ client, bucket: "bucket" }, [key])
         );
         expect(result).toEqual({
            existing: [key],
            eTags: { [key]: etag },
            sizes: {},
            unresolved: [],
         });
      } finally {
         response.emit("finish");
         client.destroy();
      }
   });

   it("discards unneeded existence-listing pages while retaining matched results", async () => {
      const budget = installBudget(1_200_000);
      const response = fakeResponse();
      let page = 0;
      const keys = Array.from({ length: 6 }, (_, index) => `${index}-wanted`);
      const client = bufferedClient(() => {
         const index = page++;
         return `<ListBucketResult><EncodingType>url</EncodingType><IsTruncated>true</IsTruncated><Contents><Key>${keys[index]}</Key><ETag>&quot;etag&quot;</ETag></Contents><Contents><Key>${index}-${"z".repeat(990)}</Key></Contents></ListBucketResult>`;
      });
      try {
         const result = await withReadResponse("alice", response, () =>
            existingKeys({ client, bucket: "bucket" }, keys)
         );
         expect(result.existing).toEqual(keys);
         expect(result.unresolved).toEqual([]);
         expect(page).toBe(6);
         const remaining = budget.acquire({ serverId: "other" });
         try {
            expect(() => remaining.retain(1_200_000)).toThrow(/capacity/);
            response.emit("finish");
            remaining.retain(1_200_000);
         } finally {
            remaining.release();
         }
      } finally {
         response.emit("close");
         client.destroy();
      }
   });

   it.each([
      [
         "listPage",
         (client: S3Client) =>
            listPage({ client, bucket: "bucket", prefix: "", blockSize: 1 }),
      ],
      [
         "listKeysPage",
         (client: S3Client) =>
            listKeysPage({ client, bucket: "bucket" }, "", undefined),
      ],
   ])(
      "%s returns the page to the pool once its rows are copied, before the response ends",
      async (_name, run) => {
         const budget = installBudget(1_200_000);
         const response = fakeResponse();
         const key = "wanted";
         const client = bufferedClient(
            () =>
               `<ListBucketResult><EncodingType>url</EncodingType><IsTruncated>false</IsTruncated><Contents><Key>${key}</Key><ETag>&quot;etag&quot;</ETag></Contents><Contents><Key>${"z".repeat(990)}</Key></Contents></ListBucketResult>`
         );
         try {
            const page = await withReadResponse("alice", response, () =>
               run(client)
            );
            expect(page.objects.map((object) => object.key)).toEqual([
               key,
               "z".repeat(990),
            ]);
            const remaining = budget.acquire({ serverId: "other" });
            try {
               remaining.retain(1_100_000);
            } finally {
               remaining.release();
            }
         } finally {
            response.emit("finish");
            client.destroy();
         }
      }
   );

   it("keeps active parsing reserved across disconnect, then releases on completion", async () => {
      installBudget();
      const response = fakeResponse();
      const parsed = Promise.withResolvers<void>();
      const finish = Promise.withResolvers<void>();
      const client = bufferedClient();
      client.middlewareStack.add(
         (next) => async (args) => {
            const result = await next(args);
            parsed.resolve();
            await finish.promise;
            return result;
         },
         { step: "deserialize", priority: "high", name: "holdAfterDisconnect" }
      );
      const pending = withReadResponse("alice", response, () => list(client));
      try {
         await Promise.race([parsed.promise, pending]);
         response.emit("close");
         await expect(
            cappedStreamCollector(Readable.from(["x"]))
         ).rejects.toMatchObject({ status: 429 });
      } finally {
         finish.resolve();
      }
      await pending;
      await expect(
         cappedStreamCollector(Readable.from([bytes]))
      ).resolves.toEqual(new Uint8Array(bytes));
      client.destroy();
   });

   it("refuses aggregate concurrent bodies and releases on stream failure", async () => {
      installBudget(bufferedBodyReservationBytes(bytes.length));
      const started = Promise.withResolvers<void>();
      let sent = false;
      const held = new Readable({
         read() {
            if (sent) return;
            sent = true;
            this.push(bytes);
            started.resolve();
         },
      });
      const pending = cappedStreamCollector(held);
      const rejected = expect(pending).rejects.toThrow("cancelled");
      await started.promise;
      await new Promise<void>((resolve) => setImmediate(resolve));
      const refused = Readable.from(["x"]);
      await expect(cappedStreamCollector(refused)).rejects.toMatchObject({
         status: 429,
      });
      expect(refused.destroyed).toBe(true);
      held.destroy(new Error("cancelled"));
      await rejected;
      await expect(
         cappedStreamCollector(Readable.from(["x"]))
      ).resolves.toEqual(new Uint8Array([120]));
   });

   it("releases when the SDK fails after collecting a successful body", async () => {
      installBudget();
      const client = bufferedClient();
      client.middlewareStack.add(
         (next) => async (args) => {
            await next(args);
            throw new Error("parse failed");
         },
         { step: "deserialize", priority: "high", name: "parseFailure" }
      );
      await expect(list(client)).rejects.toThrow("parse failed");
      await expect(
         cappedStreamCollector(Readable.from([bytes]))
      ).resolves.toEqual(new Uint8Array(bytes));
      client.destroy();
   });
});

describe("archive response memory", () => {
   const serverId = "buffered-archive";
   const userId = "archive-user";
   const archiveLimits = { maxObjects: 10_000, maxBytes: 10 * 1024 ** 3 };
   const pageXml = (contents: string, next?: string) =>
      `<ListBucketResult><EncodingType>url</EncodingType><IsTruncated>${next !== undefined}</IsTruncated>${next ? `<NextContinuationToken>${next}</NextContinuationToken>` : ""}${contents}</ListBucketResult>`;
   const objectXml = (key: string) =>
      `<Contents><Key>${encodeURIComponent(key)}</Key><Size>0</Size></Contents>`;
   const archiveClient = (page: () => string) => pageClient(page, serverId);
   const collect = (
      client: ReturnType<typeof archiveClient>,
      signal?: AbortSignal
   ) =>
      collectArchiveEntries(
         { client, bucket: "bucket", signal },
         ["folder/"],
         archiveLimits
      );

   it("preserves literal percent signs and Unicode in retained CDATA keys and tokens", async () => {
      const keys = ["folder/%41-😀.txt", "folder/%42-中.txt"];
      let page = 0;
      const client = archiveClient(() => {
         const index = page++;
         return `<ListBucketResult><IsTruncated>${index === 0}</IsTruncated>${index === 0 ? "<NextContinuationToken><![CDATA[opaque-%41-😀]]></NextContinuationToken>" : ""}<Contents><Key><![CDATA[${keys[index]}]]></Key><Size>0</Size></Contents></ListBucketResult>`;
      });
      const response = fakeResponse();
      try {
         const result = await withReadResponse(userId, response, () =>
            collect(client)
         );
         expect(result.entries.map(({ key }) => key)).toEqual(keys);
         expect(result.entries.map(({ name }) => name)).toEqual(keys);
         expect(page).toBe(2);
      } finally {
         response.emit("finish");
         client.destroy();
      }
   });

   it("holds entry memory, releases consumed pages, and frees entry memory when the response finishes", async () => {
      const budget = installReadBudget(1_000_000, THREE_READS);
      const client = archiveClient(() =>
         pageXml(
            objectXml("folder/file.txt") +
               `<Ignored>${"p".repeat(900)}</Ignored>`
         )
      );
      const response = fakeResponse();
      try {
         const result = await withReadResponse(userId, response, () =>
            collect(client)
         );
         expect(result.entries).toHaveLength(1);
         const probe = budget.acquire({ serverId, userId });
         try {
            probe.retain(999_000);
            expect(() => probe.retain(1_000)).toThrow(/capacity is busy/);
            response.emit("finish");
            expect(() => probe.retain(1_000)).not.toThrow();
         } finally {
            probe.release();
         }
      } finally {
         response.emit("finish");
         client.destroy();
      }
   });

   it.each([
      ["capacity", 4096, 429],
      ["cancelled", 1_000_000, undefined],
   ] as const)(
      "releases collection and page reservations after %s failure",
      async (failure, maxBytes, status) => {
         const budget = installReadBudget(maxBytes, THREE_READS);
         const controller = new AbortController();
         const client = archiveClient(() => {
            if (failure === "cancelled") controller.abort();
            return pageXml(
               ["a", "b", "c"]
                  .map((name) => objectXml(`folder/${name}`))
                  .join("")
            );
         });
         const response = fakeResponse();
         try {
            const pending = withReadResponse(userId, response, () =>
               collect(client, controller.signal)
            );
            if (status) await expect(pending).rejects.toMatchObject({ status });
            else await expect(pending).rejects.toBeDefined();
            const probe = budget.acquire({ serverId, userId });
            try {
               expect(() => probe.retain(maxBytes)).not.toThrow();
            } finally {
               probe.release();
            }
            const slots = Array.from({ length: 3 }, () =>
               budget.acquire({ serverId, userId })
            );
            slots.forEach((slot) => slot.release());
         } finally {
            response.emit("finish");
            client.destroy();
         }
      }
   );
});

describe("read budget under contention", () => {
   const contended = (holdMs = 10_000) =>
      createReadBudget({
         maxBytes: 128,
         maxUserBytes: 64,
         maxServerBytes: 64,
         maxReads: 8,
         maxUserReads: 4,
         maxServerReads: 4,
         contention: { above: 1 / 2, share: 1 / 4, holdMs },
      });
   const reads = (
      budget: ReturnType<typeof contended>,
      userId: string,
      serverId: string,
      count: number
   ) =>
      Array.from({ length: count }, () => budget.acquire({ userId, serverId }));

   it("lets a lone tenant use its full share while the pool is quiet", () => {
      const budget = contended();
      reads(budget, "a", "one", 4);
      expect(() => budget.acquire({ userId: "a", serverId: "one" })).toThrow(
         /capacity/
      );
   });

   it("holds each user and server to a quarter of the pool once half of it is used", () => {
      const budget = contended();
      reads(budget, "a", "one", 4);
      expect(reads(budget, "b", "two", 2)).toHaveLength(2);
      expect(() => budget.acquire({ userId: "b", serverId: "two" })).toThrow(
         /capacity/
      );
      expect(() => budget.acquire({ userId: "c", serverId: "one" })).toThrow(
         /capacity/
      );
      expect(reads(budget, "c", "three", 2)).toHaveLength(2);
   });

   it("keeps a quarter of the pool for a third tenant when two have filled their shares", () => {
      const budget = contended();
      reads(budget, "a", "one", 4);
      reads(budget, "b", "two", 2);
      expect(() => budget.acquire({ userId: "b", serverId: "two" })).toThrow(
         /capacity/
      );
      reads(budget, "c", "three", 2);
   });

   it("shrinks retained bytes the same way", () => {
      const budget = contended();
      const first = budget.acquire({ userId: "a", serverId: "one" });
      first.retain(64);
      const second = budget.acquire({ userId: "b", serverId: "two" });
      second.retain(32);
      expect(() => second.retain(1)).toThrow(/capacity/);
      const third = budget.acquire({ userId: "c", serverId: "three" });
      third.retain(32);
      expect(() => third.retain(1)).toThrow(/capacity/);
   });

   it("treats a tenant turned away for lack of pool as contention for a while", () => {
      vi.useFakeTimers();
      try {
         const budget = contended(1000);
         const filled = ["a", "b", "c", "d"].flatMap((user) =>
            reads(budget, user, `server-${user}`, 2)
         );
         expect(() =>
            budget.acquire({ userId: "e", serverId: "five" })
         ).toThrow(/capacity/);
         filled.slice(0, 7).forEach((read) => read.release());
         reads(budget, "f", "six", 2);
         expect(() => budget.acquire({ userId: "f", serverId: "six" })).toThrow(
            /capacity/
         );
         vi.advanceTimersByTime(1001);
         expect(() =>
            budget.acquire({ userId: "f", serverId: "six" })
         ).not.toThrow();
      } finally {
         vi.useRealTimers();
      }
   });
});
