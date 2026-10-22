import {
   CompleteMultipartUploadCommand,
   CreateMultipartUploadCommand,
   HeadObjectCommand,
   PutObjectCommand,
   UploadPartCommand,
   AbortMultipartUploadCommand,
   type S3Client,
} from "@aws-sdk/client-s3";
import { MAX_MULTIPART_PARTS, MAX_OBJECT_BYTES } from "@s3-viewer/types";
import { createUploadBudget } from "./upload-budget";
import { Readable, PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
// stubbed clients can't be cloned, so only a real S3Client gets its retry policy changed.
vi.mock("./no-retry", async (original) => {
   const actual = await original<typeof import("./no-retry")>();
   const s3 = await import("@aws-sdk/client-s3");
   const onlyReal =
      (clone: (client: S3Client) => S3Client) => (client: S3Client) =>
         client instanceof s3.S3Client ? clone(client) : client;
   return {
      forCleanup: onlyReal(actual.forCleanup),
      withoutRetries: onlyReal(actual.withoutRetries),
   };
});
import { exceedsMaxPartSize, partSizeFor } from "./part-size";

const MAX_DERIVED_PART_BYTES = 64 * 1024 * 1024;
import { S3_ROUTE_TIMEOUT_MS, copyDeadlineMs } from "@/lib/constants";
import {
   stallMsFor,
   StorageStalledError,
   UploadIdleError,
} from "./progress-floor";
import { UnconfirmedWriteError } from "./conditions";
import { isUploadTooLargeError } from "./stream-upload";
import {
   empty,
   errorXml,
   initiatedXml,
   reply,
   s3Fixture,
} from "@/lib/testing/s3-fixture";
import { declaredLength, streamUpload } from "./upload";

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

   it("grows the part size so a large declared length stays under MAX_MULTIPART_PARTS parts", () => {
      const contentLength = basePartBytes * MAX_MULTIPART_PARTS + 1;
      const partSize = partSizeFor(contentLength, basePartBytes);
      expect(partSize).toBeGreaterThan(basePartBytes);
      expect(Math.ceil(contentLength / partSize)).toBeLessThanOrEqual(
         MAX_MULTIPART_PARTS
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

   it("is false when the length is unknown or fits under MAX_MULTIPART_PARTS at the max part size", () => {
      expect(exceedsMaxPartSize(undefined, maxPartBytes)).toBe(false);
      expect(
         exceedsMaxPartSize(maxPartBytes * MAX_MULTIPART_PARTS, maxPartBytes)
      ).toBe(false);
   });

   it("is true when even the max part size can't fit the length under MAX_MULTIPART_PARTS parts", () => {
      expect(
         exceedsMaxPartSize(
            maxPartBytes * MAX_MULTIPART_PARTS + 1,
            maxPartBytes
         )
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

   const upload = (body: PassThrough, maxBytes = 1024 * 1024) =>
      streamUpload({
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
         maxBytes,
         abortController: new AbortController(),
         idleTimeoutMs: 40,
      });

   const KIB = Buffer.alloc(1024, 1);

   it("keeps a body that clears the floor alive across windows", async () => {
      vi.useFakeTimers();
      const body = new PassThrough();
      try {
         const pending = upload(body);
         for (let window = 0; window < 4; window++) {
            body.write(Buffer.alloc(8 * 1024, 1));
            await vi.advanceTimersByTimeAsync(30);
         }
         body.end(KIB);
         await expect(pending).resolves.toMatchObject({ eTag: '"ok"' });
         expect(vi.getTimerCount()).toBe(0);
      } finally {
         body.destroy();
         vi.useRealTimers();
      }
   });

   it("gives up on a body that trickles under the floor", async () => {
      vi.useFakeTimers();
      const body = new PassThrough();
      try {
         const pending = upload(body);
         const check = expect(pending).rejects.toBeInstanceOf(UploadIdleError);
         for (let chunk = 0; chunk < 5; chunk++) {
            body.write("x");
            await vi.advanceTimersByTimeAsync(25);
         }
         await check;
         expect(vi.getTimerCount()).toBe(0);
      } finally {
         body.destroy();
         vi.useRealTimers();
      }
   });

   it("lets a small body finish inside a window it never fills", async () => {
      vi.useFakeTimers();
      const body = new PassThrough();
      try {
         const pending = upload(body);
         await vi.advanceTimersByTimeAsync(20);
         body.end("tiny");
         await vi.advanceTimersByTimeAsync(200);
         await expect(pending).resolves.toMatchObject({ eTag: '"ok"' });
         expect(vi.getTimerCount()).toBe(0);
      } finally {
         body.destroy();
         vi.useRealTimers();
      }
   });

   it("does not charge the client for a window spent under backpressure", async () => {
      vi.useFakeTimers();
      const body = new PassThrough();
      try {
         const pending = upload(body);
         await vi.advanceTimersByTimeAsync(1);
         body.write("x");
         body.pause();
         await vi.advanceTimersByTimeAsync(200);
         expect(body.readableFlowing).toBe(false);
         body.resume();
         body.end(KIB);
         await expect(pending).resolves.toMatchObject({ eTag: '"ok"' });
         expect(vi.getTimerCount()).toBe(0);
      } finally {
         body.destroy();
         vi.useRealTimers();
      }
   });

   const PART = 5 * 1024 * 1024;
   const untilAborted = (signal: AbortSignal) =>
      new Promise<never>((_resolve, reject) =>
         signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
         })
      );
   const stalledUpload = (
      body: PassThrough,
      send: (
         command: unknown,
         options: { abortSignal: AbortSignal }
      ) => Promise<unknown>,
      expectedETag?: string
   ) => {
      const abortController = new AbortController();
      const pending = streamUpload({
         client: { config: mockConfig, send } as unknown as S3Client,
         bucket: "bucket",
         key: "key",
         contentType: "text/plain",
         expectedETag,
         body,
         contentLength: undefined,
         partSize: PART,
         maxBytes: 100 * PART,
         abortController,
         idleTimeoutMs: 40,
      });
      return { abortController, pending };
   };

   it("gives up on storage that never answers the write after the body ended", async () => {
      vi.useFakeTimers();
      const body = new PassThrough();
      try {
         const { pending } = stalledUpload(body, (_command, { abortSignal }) =>
            untilAborted(abortSignal)
         );
         const settled = vi.fn();
         pending.catch(settled);
         body.end("tiny");
         const limit = stallMsFor(40, PART) + copyDeadlineMs(4);
         await vi.advanceTimersByTimeAsync(limit - 1);
         expect(settled).not.toHaveBeenCalled();
         await vi.advanceTimersByTimeAsync(1);
         await expect(pending).rejects.toBeInstanceOf(StorageStalledError);
         expect(vi.getTimerCount()).toBe(0);
      } finally {
         body.destroy();
         vi.useRealTimers();
      }
   });

   it("gives up on storage that stops reading parts mid-body and cleans up", async () => {
      vi.useFakeTimers();
      const body = new PassThrough();
      let aborted = 0;
      try {
         const { pending } = stalledUpload(
            body,
            async (command, { abortSignal }) => {
               if (command instanceof CreateMultipartUploadCommand)
                  return { UploadId: "upload123" };
               if (command instanceof AbortMultipartUploadCommand) {
                  aborted++;
                  return {};
               }
               return untilAborted(abortSignal);
            }
         );
         const settled = vi.fn();
         pending.catch(settled);
         for (let part = 0; part < 4; part++) body.write(Buffer.alloc(PART, 1));
         await vi.advanceTimersByTimeAsync(1);
         expect(body.readableFlowing).toBe(false);
         await vi.advanceTimersByTimeAsync(stallMsFor(40, PART) - 2);
         expect(settled).not.toHaveBeenCalled();
         await vi.advanceTimersByTimeAsync(2);
         await expect(pending).rejects.toBeInstanceOf(StorageStalledError);
         expect(aborted).toBe(1);
         expect(vi.getTimerCount()).toBe(0);
      } finally {
         body.destroy();
         vi.useRealTimers();
      }
   });

   it("lets slow storage that keeps finishing parts take as long as it needs", async () => {
      vi.useFakeTimers();
      const body = new PassThrough();
      const perPart = stallMsFor(40, PART) / 2;
      let parts = 0;
      try {
         const { pending } = stalledUpload(body, async (command) => {
            if (command instanceof CreateMultipartUploadCommand)
               return { UploadId: "upload123" };
            if (command instanceof UploadPartCommand) {
               parts++;
               await new Promise((resolve) => setTimeout(resolve, perPart));
               return { ETag: '"part"' };
            }
            return { ETag: '"ok"' };
         });
         for (let part = 0; part < 6; part++) body.write(Buffer.alloc(PART, 1));
         body.end();
         await vi.advanceTimersByTimeAsync(perPart * 8);
         await expect(pending).resolves.toMatchObject({
            eTag: '"ok"',
            size: 6 * PART,
         });
         expect(parts).toBe(6);
         expect(vi.getTimerCount()).toBe(0);
      } finally {
         body.destroy();
         vi.useRealTimers();
      }
   });

   it("bounds the replacement preflight without aborting the caller's controller", async () => {
      vi.useFakeTimers();
      const body = new PassThrough();
      try {
         const { abortController, pending } = stalledUpload(
            body,
            (_command, { abortSignal }) => untilAborted(abortSignal),
            '"reviewed"'
         );
         const settled = vi.fn();
         pending.catch(settled);
         await vi.advanceTimersByTimeAsync(S3_ROUTE_TIMEOUT_MS - 1);
         expect(settled).not.toHaveBeenCalled();
         await vi.advanceTimersByTimeAsync(1);
         await expect(pending).rejects.toMatchObject({ name: "TimeoutError" });
         expect(abortController.signal.aborted).toBe(false);
         expect(vi.getTimerCount()).toBe(0);
      } finally {
         body.destroy();
         vi.useRealTimers();
      }
   });

   it("waits for cancelled part requests and multipart cleanup before settling", async () => {
      const body = new PassThrough();
      const controller = new AbortController();
      const { promise: started, resolve: startPart } =
         Promise.withResolvers<void>();
      const { promise: cleanup, resolve: completeCleanup } =
         Promise.withResolvers<void>();
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
         maxBytes: 20 * 1024 * 1024 + 1,
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

describe("fallback destination checks before streamed publication", () => {
   it.each([
      ["single part", 8, false],
      ["single part", 8, true],
      ["multipart", 5 * 1024 * 1024 + 1, false],
      ["multipart", 5 * 1024 * 1024 + 1, true],
   ])(
      "rechecks %s publication (bytes: %s; destination occupied: %s)",
      async (_mode, size, occupied) => {
         const commands: object[] = [];
         let heads = 0;
         const client = {
            config: {
               ...mockConfig,
               endpoint: async () => ({
                  protocol: "https:",
                  hostname: "minio.example.com",
                  path: "/",
               }),
            },
            send: async (command: object) => {
               commands.push(command);
               if (command instanceof HeadObjectCommand) {
                  if (++heads === 2 && occupied) return { ETag: '"other"' };
                  throw Object.assign(new Error("Not found"), {
                     name: "NotFound",
                  });
               }
               if (command instanceof CreateMultipartUploadCommand)
                  return { UploadId: "u1" };
               return { ETag: '"written"' };
            },
         } as unknown as S3Client;
         const pending = streamUpload({
            client,
            bucket: "b",
            key: "k",
            contentType: "text/plain",
            body: Readable.from([Buffer.alloc(size)]),
            contentLength: size,
            partSize: 5 * 1024 * 1024,
            maxBytes: 10 * 1024 * 1024,
            abortController: new AbortController(),
         });
         if (occupied)
            await expect(pending).rejects.toMatchObject({ status: 409 });
         else
            await expect(pending).resolves.toEqual({ size, eTag: '"written"' });
         expect(heads).toBe(2);
         const publications = commands.filter(
            (command) =>
               command instanceof PutObjectCommand ||
               command instanceof CompleteMultipartUploadCommand
         );
         expect(publications).toHaveLength(occupied ? 0 : 1);
         if (!occupied) {
            expect(
               (publications[0] as PutObjectCommand).input.IfNoneMatch
            ).toBe("*");
            expect(commands.at(-2)).toBeInstanceOf(HeadObjectCommand);
         }
         expect(
            commands.filter(
               (command) => command instanceof AbortMultipartUploadCommand
            )
         ).toHaveLength(occupied && size > 5 * 1024 * 1024 ? 1 : 0);
      }
   );
});

describe("multipart completion", () => {
   it.each(["disconnect", "S3 error"])(
      "waits for orphan cleanup after %s during completion",
      async (failure) => {
         const controller = new AbortController();
         const original = new Error(failure);
         const { promise: started, resolve: completing } =
            Promise.withResolvers<void>();
         const { promise: cleanupStarted, resolve: cleaning } =
            Promise.withResolvers<void>();
         const { promise: cleanupFinished, resolve: finishCleanup } =
            Promise.withResolvers<void>();
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
            maxBytes: 20 * 1024 * 1024 + 1,
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
      const { promise: started, resolve: completing } =
         Promise.withResolvers<void>();
      const { promise: completed, resolve: finish } =
         Promise.withResolvers<void>();
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
      const { promise: blocked, resolve: unblock } =
         Promise.withResolvers<void>();
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

describe("upload transport does not replay ambiguous writes", () => {
   it.each([
      { failAt: "put", failAbortOnce: false },
      { failAt: "create", failAbortOnce: false },
      { failAt: "complete", failAbortOnce: false },
      { failAt: "complete", failAbortOnce: true },
   ])(
      "makes one $failAt attempt and permits cleanup retry: $failAbortOnce",
      async ({ failAt, failAbortOnce }) => {
         const calls: string[] = [];
         const { client } = s3Fixture(
            async (request) => {
               const step =
                  request.method === "HEAD"
                     ? "head"
                     : request.method === "DELETE"
                       ? "abort"
                       : Object.hasOwn(request.query, "uploads")
                         ? "create"
                         : request.query.partNumber
                           ? "part"
                           : request.query.uploadId
                             ? "complete"
                             : "put";
               calls.push(step);
               if (step === "head") return empty(404);
               if (
                  step === failAt ||
                  (step === "abort" &&
                     failAbortOnce &&
                     calls.filter((call) => call === "abort").length === 1)
               )
                  return reply(503, errorXml("ServiceUnavailable"));
               const body = step === "create" ? initiatedXml("upload1") : "";
               return reply(200, body, {
                  etag: '"part"',
               });
            },
            { maxAttempts: 3, requestChecksumCalculation: "WHEN_REQUIRED" }
         );
         const size = failAt === "put" ? 1 : 6 * 1024 * 1024;
         const failure: unknown = await streamUpload({
            client,
            bucket: "test",
            key: "file",
            contentType: "application/octet-stream",
            body: Readable.from([Buffer.alloc(size)]),
            contentLength: size,
            partSize: 5 * 1024 * 1024,
            maxBytes: size,
            abortController: new AbortController(),
         }).catch((error: unknown) => error);
         // a 5xx on the commit itself leaves the write unconfirmed; anything earlier is a plain failure.
         if (failAt === "create")
            expect(failure).toMatchObject({
               $metadata: { httpStatusCode: 503, attempts: 1 },
            });
         else expect(failure).toBeInstanceOf(UnconfirmedWriteError);
         expect(calls.filter((step) => step === failAt)).toHaveLength(1);
         if (failAt === "complete")
            expect(calls.filter((step) => step === "abort")).toHaveLength(
               failAbortOnce ? 2 : 1
            );
         expect(await client.config.maxAttempts()).toBe(3);
      }
   );
});
