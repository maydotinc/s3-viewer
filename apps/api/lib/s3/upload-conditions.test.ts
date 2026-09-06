import {
   AbortMultipartUploadCommand,
   CompleteMultipartUploadCommand,
   CreateMultipartUploadCommand,
   PutObjectCommand,
   S3Client,
   UploadPartCommand,
} from "@aws-sdk/client-s3";
import { Provider } from "@s3-viewer/types";
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { getS3ClientFromCredentials } from "./client-cache";
import { streamUpload } from "./upload";

const MIB = 1024 * 1024;
const config = {
   requestHandler: {},
   endpoint: async () => ({
      protocol: "https:",
      hostname: "s3.us-east-1.amazonaws.com",
      path: "/",
   }),
   requestChecksumCalculation: async () => "WHEN_REQUIRED",
   forcePathStyle: true,
};
type Command =
   | PutObjectCommand
   | CreateMultipartUploadCommand
   | UploadPartCommand
   | CompleteMultipartUploadCommand
   | AbortMultipartUploadCommand;

const params = (client: S3Client, size: number, expectedETag?: string) => ({
   client,
   bucket: "backups",
   key: "db.sql",
   contentType: "text/plain",
   body: Readable.from([Buffer.alloc(size, 1)]),
   contentLength: size,
   partSize: 5 * MIB,
   maxBytes: 10 * MIB,
   abortController: new AbortController(),
   expectedETag,
});

describe("conditional uploads", () => {
   it.each([
      { size: 8, expectedETag: undefined },
      { size: 6 * MIB, expectedETag: undefined },
      { size: 8, expectedETag: '"confirmed"' },
      { size: 6 * MIB, expectedETag: '"confirmed"' },
   ])(
      "sends the condition over the SDK transport for $size bytes / $expectedETag",
      async ({ size, expectedETag }) => {
         let commits = 0;
         const client = new S3Client({
            endpoint: "https://s3.us-east-1.amazonaws.com",
            region: "us-east-1",
            credentials: { accessKeyId: "test", secretAccessKey: "test" },
            requestChecksumCalculation: "WHEN_REQUIRED",
            requestHandler: {
               handle: async (request: {
                  method: string;
                  query: Record<string, unknown>;
                  headers: Record<string, string>;
               }) => {
                  let body = "";
                  if (
                     request.method === "POST" &&
                     Object.hasOwn(request.query, "uploads")
                  ) {
                     body =
                        "<InitiateMultipartUploadResult><UploadId>upload1</UploadId></InitiateMultipartUploadResult>";
                  } else if (
                     !(request.method === "PUT" && request.query.partNumber)
                  ) {
                     commits++;
                     expect(request.headers["if-none-match"]).toBe(
                        expectedETag === undefined ? "*" : undefined
                     );
                     expect(request.headers["if-match"]).toBe(expectedETag);
                     if (request.method === "POST")
                        body =
                           '<CompleteMultipartUploadResult><ETag>"new"</ETag></CompleteMultipartUploadResult>';
                  }
                  return {
                     response: {
                        statusCode: 200,
                        headers: { etag: '"new"' },
                        body: Readable.from(body ? [body] : []),
                     },
                  };
               },
            },
         });
         await streamUpload(params(client, size, expectedETag));
         expect(commits).toBe(1);
      }
   );

   it.each([8, 6 * MIB])(
      "preserves an intervening create for a %i-byte upload",
      async (size) => {
         let stored = "other writer's data";
         const cleanup = vi.fn();
         const send = vi.fn(async (command: Command) => {
            if (command instanceof CreateMultipartUploadCommand)
               return { UploadId: "upload1" };
            if (command instanceof UploadPartCommand) return { ETag: '"part"' };
            if (command instanceof AbortMultipartUploadCommand) {
               cleanup();
               return {};
            }
            expect(command.input.IfNoneMatch).toBe("*");
            expect(command.input.IfMatch).toBeUndefined();
            if (command.input.IfNoneMatch === "*" && stored) {
               throw Object.assign(new Error("conflict"), {
                  name: "PreconditionFailed",
               });
            }
            stored = "lost update";
            return { ETag: '"new"' };
         });
         const client = { config, send } as unknown as S3Client;
         await expect(streamUpload(params(client, size))).rejects.toMatchObject(
            { status: 409 }
         );
         expect(stored).toBe("other writer's data");
         expect(cleanup).toHaveBeenCalledTimes(size > 5 * MIB ? 1 : 0);
      }
   );

   it.each([8, 6 * MIB])(
      "rejects replacement of a changed object for a %i-byte upload",
      async (size) => {
         let stored = '"changed"';
         const client = {
            config,
            send: async (command: Command) => {
               if (command instanceof CreateMultipartUploadCommand)
                  return { UploadId: "upload1" };
               if (command instanceof UploadPartCommand)
                  return { ETag: '"part"' };
               if (command instanceof AbortMultipartUploadCommand) return {};
               expect(command.input.IfMatch).toBe('"confirmed"');
               expect(command.input.IfNoneMatch).toBeUndefined();
               if (command.input.IfMatch !== stored) {
                  throw Object.assign(new Error("conflict"), {
                     $metadata: { httpStatusCode: 412 },
                  });
               }
               stored = '"overwritten"';
               return { ETag: stored };
            },
         } as unknown as S3Client;
         await expect(
            streamUpload(params(client, size, '"confirmed"'))
         ).rejects.toMatchObject({ status: 409 });
         expect(stored).toBe('"changed"');
      }
   );

   it.each([8, 6 * MIB])(
      "allows a confirmed unchanged replacement for %i bytes",
      async (size) => {
         const client = {
            config,
            send: async (command: Command) => {
               if (command instanceof CreateMultipartUploadCommand)
                  return { UploadId: "upload1" };
               if (command instanceof UploadPartCommand)
                  return { ETag: '"part"' };
               if (command instanceof AbortMultipartUploadCommand)
                  throw new Error("Unexpected cleanup");
               expect(command.input.IfMatch).toBe('"confirmed"');
               return { ETag: '"new"' };
            },
         } as unknown as S3Client;
         await expect(
            streamUpload(params(client, size, '"confirmed"'))
         ).resolves.toEqual({ size, eTag: '"new"' });
      }
   );

   it("refuses unverified endpoints before reading or writing data", async () => {
      const send = vi.fn();
      const client = {
         config: {
            ...config,
            endpoint: async () => ({
               protocol: "https:",
               hostname: "custom.example.com",
            }),
         },
         send,
      } as unknown as S3Client;
      const input = params(client, 10);
      await expect(streamUpload(input)).rejects.toMatchObject({ status: 409 });
      expect(send).not.toHaveBeenCalled();
      expect(input.body.readableDidRead).toBe(false);
   });
});

describe("R2 conditional streaming", () => {
   const r2Config = {
      ...config,
      endpoint: async () => ({
         protocol: "https:",
         hostname: "account.r2.cloudflarestorage.com",
         path: "/",
      }),
   };

   it("streams a large body through one conditional PUT without losing bytes before the SDK consumes it", async () => {
      let received = 0;
      const send = vi.fn(async (command: PutObjectCommand) => {
         expect(command).toBeInstanceOf(PutObjectCommand);
         expect(command.input.IfNoneMatch).toBe("*");
         await new Promise<void>((resolve) => setImmediate(resolve));
         for await (const chunk of command.input.Body as Readable)
            received += Buffer.byteLength(chunk);
         return { ETag: '"r2"' };
      });
      const client = { config: r2Config, send } as unknown as S3Client;
      await expect(streamUpload(params(client, 6 * MIB))).resolves.toEqual({
         size: 6 * MIB,
         eTag: '"r2"',
      });
      expect(received).toBe(6 * MIB);
      expect(send).toHaveBeenCalledTimes(1);
   });

   it("serializes the replacement condition and an unencoded Content-Length with the actual SDK", async () => {
      const base = getS3ClientFromCredentials(
         {
            endpoint: "https://account.r2.cloudflarestorage.com",
            region: "auto",
            accessKey: "test",
            secretKey: "test",
         },
         Provider.R2
      );
      expect(await base.config.requestChecksumCalculation()).toBe(
         "WHEN_REQUIRED"
      );
      let received = 0;
      const handle = vi.fn(
         async (request: {
            headers: Record<string, string>;
            body?: unknown;
         }) => {
            expect(request.headers["if-match"]).toBe('"confirmed"');
            expect(request.headers["if-none-match"]).toBeUndefined();
            expect(request.headers["content-length"]).toBe("12");
            expect(request.headers["content-encoding"]).toBeUndefined();
            expect(request.headers["x-amz-trailer"]).toBeUndefined();
            for await (const chunk of request.body as Readable)
               received += Buffer.byteLength(chunk);
            return {
               response: {
                  statusCode: 200,
                  headers: { etag: '"r2"' },
                  body: Readable.from([]),
               },
            };
         }
      );
      const client = new S3Client({
         ...base.config,
         retryStrategy: undefined,
         serviceConfiguredEndpoint: undefined,
         requestHandler: { handle },
      });
      await expect(
         streamUpload(params(client, 12, '"confirmed"'))
      ).resolves.toEqual({ size: 12, eTag: '"r2"' });
      expect(received).toBe(12);
   });

   it.each([undefined, 5 * 1024 ** 3 - 5 * MIB + 1])(
      "rejects an unsupported content length %s before writing",
      async (contentLength) => {
         const send = vi.fn();
         const client = { config: r2Config, send } as unknown as S3Client;
         await expect(
            streamUpload({ ...params(client, 0), contentLength })
         ).rejects.toMatchObject({
            status: contentLength === undefined ? 411 : 413,
         });
         expect(send).not.toHaveBeenCalled();
      }
   );
});
