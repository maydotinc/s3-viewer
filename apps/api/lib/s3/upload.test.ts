import {
   CompleteMultipartUploadCommand,
   CreateMultipartUploadCommand,
   UploadPartCommand,
   AbortMultipartUploadCommand,
   type S3Client,
} from "@aws-sdk/client-s3";
import { createUploadBudget } from "./upload-budget";
import { Readable, PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import {
   UploadIdleError,
   declaredLength,
   exceedsMaxPartSize,
   isUploadTooLargeError,
   MAX_DERIVED_PART_BYTES,
   MAX_OBJECT_BYTES,
   MAX_PARTS,
   partSizeFor,
   streamUpload,
} from "./upload";

const mockConfig = {
   requestHandler: {},
   endpoint: async () => ({
      protocol: "https:",
      hostname: "s3.us-east-1.amazonaws.com",
      path: "/",
   }),
   requestChecksumCalculation: async () => "WHEN_REQUIRED",
   forcePathStyle: true,
};

describe("declaredLength", () => {
   it("parses a well-formed Content-Length", () => {
      expect(declaredLength("0")).toBe(0);
      expect(declaredLength("1048576")).toBe(1048576);
   });

   it("is undefined when the header is missing or malformed", () => {
      expect(declaredLength(undefined)).toBeUndefined();
      expect(declaredLength("")).toBeUndefined();
      expect(declaredLength("abc")).toBeUndefined();
      expect(declaredLength("-1")).toBeUndefined();
      expect(declaredLength("1.5")).toBeUndefined();
      expect(declaredLength("1e400")).toBeUndefined();
   });
});

describe("partSizeFor", () => {
   const basePartBytes = 25 * 1024 * 1024;

   it("uses the base part size when the length is unknown or small", () => {
      expect(partSizeFor(undefined, basePartBytes)).toBe(basePartBytes);
      expect(partSizeFor(1024, basePartBytes)).toBe(basePartBytes);
   });

   it("grows the part size so a large declared length stays under MAX_PARTS parts", () => {
      const contentLength = basePartBytes * MAX_PARTS + 1;
      const partSize = partSizeFor(contentLength, basePartBytes);
      expect(partSize).toBeGreaterThan(basePartBytes);
      expect(Math.ceil(contentLength / partSize)).toBeLessThanOrEqual(
         MAX_PARTS
      );
   });

   it("clamps the derived part size so a huge declared length can't eat the heap", () => {
      expect(partSizeFor(MAX_OBJECT_BYTES, basePartBytes)).toBe(
         MAX_DERIVED_PART_BYTES
      );
      expect(partSizeFor(5 * 1024 ** 4, basePartBytes)).toBeLessThanOrEqual(
         MAX_DERIVED_PART_BYTES
      );
   });

   it("never clamps below a part size the operator asked for", () => {
      const bigBase = 512 * 1024 * 1024;
      expect(partSizeFor(MAX_OBJECT_BYTES, bigBase)).toBe(bigBase);
      expect(partSizeFor(undefined, bigBase)).toBe(bigBase);
   });
});

describe("exceedsMaxPartSize", () => {
   const maxPartBytes = 100 * 1024 * 1024;

   it("is false when the length is unknown or fits under MAX_PARTS at the max part size", () => {
      expect(exceedsMaxPartSize(undefined, maxPartBytes)).toBe(false);
      expect(exceedsMaxPartSize(maxPartBytes * MAX_PARTS, maxPartBytes)).toBe(
         false
      );
   });

   it("is true when even the max part size can't fit the length under MAX_PARTS parts", () => {
      expect(
         exceedsMaxPartSize(maxPartBytes * MAX_PARTS + 1, maxPartBytes)
      ).toBe(true);
   });
});

describe("streamUpload byte cap", () => {
   const collect = async (chunks: Buffer[], maxBytes: number) => {
      const body = Readable.from(chunks);
      const sent: Buffer[] = [];
      const client = {
         config: mockConfig,
         send: async (command: { input: { Body?: unknown } }) => {
            const part = command.input.Body;
            if (part !== undefined) sent.push(Buffer.from(part as Uint8Array));
            return { ETag: '"etag"' };
         },
      } as unknown as S3Client;

      await streamUpload({
         client,
         bucket: "b",
         key: "k",
         contentType: "application/octet-stream",
         body,
         contentLength: undefined,
         partSize: 5 * 1024 * 1024,
         maxBytes,
         abortController: new AbortController(),
      });
      return Buffer.concat(sent).length;
   };

   it("rejects a chunked body that streams past the cap", async () => {
      const chunk = Buffer.alloc(64 * 1024, 1);
      await expect(
         collect([chunk, chunk, chunk], 100 * 1024)
      ).rejects.toSatisfy(isUploadTooLargeError);
   });

   it("does not trip the cap for a body at exactly the limit", async () => {
      const chunk = Buffer.alloc(64 * 1024, 1);
      await expect(collect([chunk], 64 * 1024)).resolves.toBe(64 * 1024);
   });

   it("trips the cap one byte over the limit", async () => {
      const chunk = Buffer.alloc(64 * 1024, 1);
      const err = await collect([chunk], 64 * 1024 - 1).catch(
         (e: unknown) => e
      );
      expect(isUploadTooLargeError(err)).toBe(true);
   });
});

describe("upload lifetime", () => {
   it("aborts a stalled input and clears the watchdog", async () => {
      vi.useFakeTimers();
      const body = new PassThrough();
      try {
         const pending = streamUpload({
            client: {
               config: mockConfig,
               send: vi.fn(),
            } as unknown as S3Client,
            bucket: "bucket",
            key: "key",
            contentType: "text/plain",
            body,
            contentLength: undefined,
            partSize: 5 * 1024 * 1024,
            maxBytes: 100,
            abortController: new AbortController(),
            idleTimeoutMs: 40,
         });
         const check = expect(pending).rejects.toBeInstanceOf(UploadIdleError);
         await vi.advanceTimersByTimeAsync(41);
         await check;
         expect(vi.getTimerCount()).toBe(0);
      } finally {
         body.destroy();
         vi.useRealTimers();
      }
   });

   it("resets the inactivity deadline as input arrives", async () => {
      vi.useFakeTimers();
      const body = new PassThrough();
      try {
         const pending = streamUpload({
            client: {
               config: mockConfig,
               send: async () => ({ ETag: '"ok"' }),
            } as unknown as S3Client,
            bucket: "bucket",
            key: "key",
            contentType: "text/plain",
            body,
            contentLength: undefined,
            partSize: 5 * 1024 * 1024,
            maxBytes: 100,
            abortController: new AbortController(),
            idleTimeoutMs: 40,
         });
         await vi.advanceTimersByTimeAsync(30);
         body.write("a");
         await vi.advanceTimersByTimeAsync(30);
         body.end("b");
         await expect(pending).resolves.toMatchObject({ eTag: '"ok"' });
         expect(vi.getTimerCount()).toBe(0);
      } finally {
         body.destroy();
         vi.useRealTimers();
      }
   });

   it("waits for cancelled part requests and multipart cleanup before settling", async () => {
      const body = new PassThrough();
      const controller = new AbortController();
      let startPart!: () => void;
      const started = new Promise<void>((resolve) => {
         startPart = resolve;
      });
      let completeCleanup!: () => void;
      const cleanup = new Promise<void>((resolve) => {
         completeCleanup = resolve;
      });
      let cleanupSignal: AbortSignal | undefined;
      const client = {
         config: mockConfig,
         send: async (
            command:
               | CreateMultipartUploadCommand
               | UploadPartCommand
               | AbortMultipartUploadCommand,
            options: { abortSignal: AbortSignal }
         ) => {
            if (command instanceof CreateMultipartUploadCommand)
               return { UploadId: "upload123" };
            if (command instanceof UploadPartCommand) {
               startPart();
               return new Promise((_resolve, reject) =>
                  options.abortSignal.addEventListener(
                     "abort",
                     () => reject(options.abortSignal.reason),
                     { once: true }
                  )
               );
            }
            if (command instanceof AbortMultipartUploadCommand) {
               cleanupSignal = options.abortSignal;
               await cleanup;
               return {};
            }
            throw new Error("Unexpected S3 command");
         },
      } as unknown as S3Client;
      const budget = createUploadBudget({
         maxUploads: 1,
         maxPerUser: 1,
         maxBytes: 20 * 1024 * 1024,
      });
      const release = budget.acquire("user1", 20 * 1024 * 1024);
      const pending = streamUpload({
         client,
         bucket: "bucket",
         key: "key",
         contentType: "text/plain",
         body,
         contentLength: undefined,
         partSize: 5 * 1024 * 1024,
         maxBytes: 10 * 1024 * 1024,
         abortController: controller,
      }).finally(release);
      const rejected = expect(pending).rejects.toBeDefined();
      body.write(Buffer.alloc(5 * 1024 * 1024 + 1));
      await started;
      controller.abort(new Error("Client disconnected"));
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(cleanupSignal?.aborted).toBe(false);
      expect(() => budget.acquire("user2", 1)).toThrow(/busy/);
      completeCleanup();
      await rejected;
      expect(() => budget.acquire("user2", 1)).not.toThrow();
      body.destroy();
   });
});

describe("multipart completion", () => {
   it.each(["disconnect", "S3 error"])(
      "waits for orphan cleanup after %s during completion",
      async (failure) => {
         const controller = new AbortController();
         const original = new Error(failure);
         let completing!: () => void,
            cleaning!: () => void,
            finishCleanup!: () => void;
         const started = new Promise<void>((resolve) => {
            completing = resolve;
         });
         const cleanupStarted = new Promise<void>((resolve) => {
            cleaning = resolve;
         });
         const cleanupFinished = new Promise<void>((resolve) => {
            finishCleanup = resolve;
         });
         const client = {
            config: mockConfig,
            send: async (
               command:
                  | CreateMultipartUploadCommand
                  | UploadPartCommand
                  | CompleteMultipartUploadCommand
                  | AbortMultipartUploadCommand,
               options: { abortSignal: AbortSignal }
            ) => {
               if (command instanceof CreateMultipartUploadCommand)
                  return { UploadId: "upload123" };
               if (command instanceof UploadPartCommand)
                  return { ETag: '"part"' };
               if (command instanceof CompleteMultipartUploadCommand) {
                  completing();
                  if (failure === "S3 error") throw original;
                  return new Promise((_resolve, reject) =>
                     options.abortSignal.addEventListener(
                        "abort",
                        () => reject(original),
                        { once: true }
                     )
                  );
               }
               if (command instanceof AbortMultipartUploadCommand) {
                  expect(options.abortSignal.aborted).toBe(false);
                  cleaning();
                  await cleanupFinished;
                  return {};
               }
               throw new Error("Unexpected command");
            },
         } as unknown as S3Client;
         const budget = createUploadBudget({
            maxUploads: 1,
            maxPerUser: 1,
            maxBytes: 20 * 1024 * 1024,
         });
         const release = budget.acquire("user1", 20 * 1024 * 1024);
         const pending = streamUpload({
            client,
            bucket: "b",
            key: "k",
            contentType: "text/plain",
            body: Readable.from([Buffer.alloc(5 * 1024 * 1024 + 1)]),
            contentLength: undefined,
            partSize: 5 * 1024 * 1024,
            maxBytes: 10 * 1024 * 1024,
            abortController: controller,
         }).finally(release);
         const rejected = expect(pending).rejects.toBe(original);
         await started;
         if (failure === "disconnect") controller.abort(original);
         await cleanupStarted;
         expect(() => budget.acquire("user2", 1)).toThrow(/busy/);
         finishCleanup();
         await rejected;
         expect(() => budget.acquire("user2", 1)).not.toThrow();
      }
   );

   it("allows S3 completion beyond the input deadline after EOF", async () => {
      vi.useFakeTimers();
      const controller = new AbortController();
      let completing!: () => void, finish!: () => void;
      const started = new Promise<void>((resolve) => {
         completing = resolve;
      });
      const completed = new Promise<void>((resolve) => {
         finish = resolve;
      });
      const client = {
         config: mockConfig,
         send: async (
            command:
               | CreateMultipartUploadCommand
               | CompleteMultipartUploadCommand
         ) => {
            if (command instanceof CreateMultipartUploadCommand)
               return { UploadId: "upload123" };
            if (command instanceof CompleteMultipartUploadCommand) {
               completing();
               await completed;
            }
            return { ETag: '"ok"' };
         },
      } as unknown as S3Client;
      try {
         const pending = streamUpload({
            client,
            bucket: "b",
            key: "k",
            contentType: "text/plain",
            body: Readable.from([Buffer.alloc(5 * 1024 * 1024 + 1)]),
            contentLength: undefined,
            partSize: 5 * 1024 * 1024,
            maxBytes: 10 * 1024 * 1024,
            abortController: controller,
            idleTimeoutMs: 40,
         });
         await started;
         await vi.advanceTimersByTimeAsync(400);
         expect(controller.signal.aborted).toBe(false);
         finish();
         await expect(pending).resolves.toMatchObject({ eTag: '"ok"' });
         expect(vi.getTimerCount()).toBe(0);
      } finally {
         vi.useRealTimers();
      }
   });

   it("pauses the client deadline while S3 backpressures input", async () => {
      vi.useFakeTimers();
      const body = new PassThrough();
      const controller = new AbortController();
      let unblock!: () => void;
      const blocked = new Promise<void>((resolve) => {
         unblock = resolve;
      });
      const client = {
         config: mockConfig,
         send: async (
            command: CreateMultipartUploadCommand | UploadPartCommand
         ) => {
            if (command instanceof CreateMultipartUploadCommand)
               return { UploadId: "upload123" };
            if (command instanceof UploadPartCommand) await blocked;
            return { ETag: '"ok"' };
         },
      } as unknown as S3Client;
      try {
         const pending = streamUpload({
            client,
            bucket: "b",
            key: "k",
            contentType: "text/plain",
            body,
            contentLength: undefined,
            partSize: 5 * 1024 * 1024,
            maxBytes: 25 * 1024 * 1024,
            abortController: controller,
            idleTimeoutMs: 40,
         });
         for (let n = 0; n < 4; n++) body.write(Buffer.alloc(5 * 1024 * 1024));
         await vi.advanceTimersByTimeAsync(1);
         expect(body.readableFlowing).toBe(false);
         await vi.advanceTimersByTimeAsync(400);
         expect(controller.signal.aborted).toBe(false);
         body.end();
         unblock();
         await expect(pending).resolves.toMatchObject({ eTag: '"ok"' });
         expect(vi.getTimerCount()).toBe(0);
      } finally {
         body.destroy();
         vi.useRealTimers();
      }
   });
});
