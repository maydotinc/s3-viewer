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
vi.mock("./no-retry", () => ({ withoutRetries: (client: S3Client) => client }));
// These tests isolate publication conditions. Full preservation reads and
// their failures are exercised through the real SDK in replacement-settings.test.
vi.mock("./replacement-settings", () => ({
   readReplacementSettings: async () => ({ attributes: {} }),
   assertReplacementUnchanged: () => undefined,
}));

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
   it.each([8, 6 * MIB])(
      "blocks unverified B2 writes before reading %i bytes",
      async (size) => {
         const handle = vi.fn();
         const client = new S3Client({
            endpoint: "https://s3.us-west-004.backblazeb2.com",
            region: "us-west-004",
            credentials: { accessKeyId: "test", secretAccessKey: "test" },
            requestHandler: { handle },
         });
         const input = params(client, size);
         const read = vi.fn();
         input.body.on("data", read);
         input.body.pause();
         try {
            await expect(streamUpload(input)).rejects.toMatchObject({
               status: 409,
               message: expect.stringContaining("Backblaze B2"),
            });
            expect(handle).not.toHaveBeenCalled();
            expect(read).not.toHaveBeenCalled();
         } finally {
            input.body.destroy();
            client.destroy();
         }
      }
   );

   it.each(
      [
         { size: 8, expectedETag: undefined },
         { size: 6 * MIB, expectedETag: undefined },
         { size: 8, expectedETag: '"confirmed"' },
         { size: 6 * MIB, expectedETag: '"confirmed"' },
      ].flatMap((input) =>
         [
            "https://s3.us-east-1.amazonaws.com",
            "https://account.r2.cloudflarestorage.com",
            "https://minio.example.com",
         ].map((endpoint) => ({ ...input, endpoint }))
      )
   )(
      "sends the condition over the SDK transport for $endpoint / $size bytes / $expectedETag",
      async ({ size, expectedETag, endpoint }) => {
         let commits = 0;
         const client = new S3Client({
            endpoint,
            forcePathStyle: true,
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
                     if (!endpoint.includes("amazonaws.com")) {
                        expect(request.headers["if-none-match"]).toBe(
                           expectedETag === undefined ? "*" : undefined
                        );
                        expect(request.headers["if-match"]).toBe(expectedETag);
                     }
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

   it("supports a custom MinIO-compatible endpoint with conditional writes", async () => {
      const send = vi.fn(async (command: PutObjectCommand) => {
         expect(command.input.IfNoneMatch).toBe("*");
         return { ETag: '"minio"' };
      });
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
      await expect(streamUpload(input)).resolves.toEqual({
         size: 10,
         eTag: '"minio"',
      });
      expect(send).toHaveBeenCalledOnce();
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

   it("streams a large body through multipart and conditions the final commit", async () => {
      let received = 0;
      const send = vi.fn(async (command: Command) => {
         if (command instanceof CreateMultipartUploadCommand)
            return { UploadId: "r2-upload" };
         if (command instanceof CompleteMultipartUploadCommand) {
            expect(command.input.IfNoneMatch).toBe("*");
            return { ETag: '"r2"' };
         }
         expect(command).toBeInstanceOf(UploadPartCommand);
         await new Promise<void>((resolve) => setImmediate(resolve));
         received += Buffer.byteLength(
            (command as UploadPartCommand).input.Body as Uint8Array
         );
         return { ETag: '"part"' };
      });
      const client = { config: r2Config, send } as unknown as S3Client;
      await expect(streamUpload(params(client, 6 * MIB))).resolves.toEqual({
         size: 6 * MIB,
         eTag: '"r2"',
      });
      expect(received).toBe(6 * MIB);
      expect(send).toHaveBeenCalledTimes(4);
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
            if (request.body instanceof Uint8Array)
               received += request.body.byteLength;
            else
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

   it("supports R2 multipart when the incoming stream has no Content-Length", async () => {
      const send = vi.fn(async (command: Command) => {
         if (command instanceof CreateMultipartUploadCommand)
            return { UploadId: "r2-upload" };
         if (command instanceof CompleteMultipartUploadCommand)
            expect(command.input.IfMatch).toBe('"confirmed"');
         return { ETag: '"r2"' };
      });
      const client = { config: r2Config, send } as unknown as S3Client;
      await expect(
         streamUpload({
            ...params(client, 6 * MIB, '"confirmed"'),
            contentLength: undefined,
         })
      ).resolves.toEqual({ size: 6 * MIB, eTag: '"r2"' });
      expect(
         send.mock.calls.some(
            ([command]) => command instanceof CompleteMultipartUploadCommand
         )
      ).toBe(true);
   });
});
