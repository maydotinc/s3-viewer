import { AbortMultipartUploadCommand, type S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { Transform, type Readable } from "node:stream";
import { logger } from "../logger";
import { UPLOAD_QUEUE_SIZE } from "./upload-budget";

const MAX_PARTS = 10_000;
const MIB = 1024 * 1024;
const TIB = 1024 ** 4;
const MAX_OBJECT_BYTES = 5 * TIB;
const MAX_DERIVED_PART_BYTES = 64 * MIB;

class UploadTooLargeError extends Error {
   readonly limit: number;

   constructor(limit: number) {
      super(`Uploads are limited to ${limit} bytes`);
      this.name = "UploadTooLargeError";
      this.limit = limit;
   }
}

class UploadIdleError extends Error {
   constructor() {
      super("Upload stopped receiving data. Try again.");
      this.name = "UploadIdleError";
   }
}

const isUploadTooLargeError = (err: unknown): err is UploadTooLargeError =>
   err instanceof UploadTooLargeError;

const limitBytes = (limit: number, onChunk: () => void): Transform => {
   let total = 0;
   return new Transform({
      transform(chunk, _encoding, done) {
         onChunk();
         total += chunk.length;
         if (total > limit) {
            done(new UploadTooLargeError(limit));
            return;
         }
         done(null, chunk);
      },
   });
};

const declaredLength = (header: string | undefined): number | undefined => {
   if (header === undefined || header.trim() === "") return undefined;
   const length = Number(header);
   return Number.isSafeInteger(length) && length >= 0 ? length : undefined;
};

const exceedsLimit = (
   length: number | undefined,
   limit: number | undefined
): boolean => limit !== undefined && length !== undefined && length > limit;

const minPartSizeFor = (contentLength: number): number =>
   Math.ceil(contentLength / MAX_PARTS);

// queueSize parts are buffered in memory at once, so a declared length never
// grows the part size past this on its own
const maxPartBytesFor = (basePartBytes: number): number =>
   Math.max(basePartBytes, MAX_DERIVED_PART_BYTES);

const exceedsObjectLimit = (length: number | undefined): boolean =>
   length !== undefined && length > MAX_OBJECT_BYTES;

const exceedsMaxPartSize = (
   length: number | undefined,
   maxPartBytes: number
): boolean => length !== undefined && minPartSizeFor(length) > maxPartBytes;

const partSizeFor = (
   contentLength: number | undefined,
   basePartBytes: number
): number =>
   contentLength === undefined
      ? basePartBytes
      : Math.min(
           maxPartBytesFor(basePartBytes),
           Math.max(basePartBytes, minPartSizeFor(contentLength))
        );

type StreamUploadParams = {
   client: S3Client;
   bucket: string;
   key: string;
   contentType: string;
   body: Readable;
   contentLength: number | undefined;
   partSize: number;
   maxBytes: number;
   abortController: AbortController;
   idleTimeoutMs?: number;
};

type StreamUploadResult = { size: number; eTag: string | null };

const streamUpload = async ({
   client,
   bucket,
   key,
   contentType,
   body,
   contentLength,
   partSize,
   maxBytes,
   abortController,
   idleTimeoutMs = 120_000,
}: StreamUploadParams): Promise<StreamUploadResult> => {
   let idle: ReturnType<typeof setTimeout> | undefined;
   const clearIdle = () => clearTimeout(idle);
   const resetIdle = () => {
      clearIdle();
      // Backpressure means S3 is busy, not that the client is stalled. Only
      // time the client while we demand input; S3 has its own idle timeout.
      if (!body.readableFlowing || body.readableEnded) return;
      idle = setTimeout(
         () => abortController.abort(new UploadIdleError()),
         idleTimeoutMs
      );
      idle.unref();
   };
   const limiter = limitBytes(maxBytes, resetIdle);
   body.on("pause", clearIdle);
   body.on("resume", resetIdle);
   body.on("end", clearIdle);
   const onBodyError = (err: Error) => limiter.destroy(err);
   const onAbort = () =>
      limiter.destroy(
         abortController.signal.reason instanceof Error
            ? abortController.signal.reason
            : new Error("Upload aborted")
      );
   body.on("error", onBodyError);
   limiter.on("error", () => {
      body.unpipe(limiter);
      body.pause();
   });
   abortController.signal.addEventListener("abort", onAbort, { once: true });

   // Upload.done() races its own AbortController and can otherwise return
   // while buffered parts are still being sent. Cancel the input and each
   // S3 request instead, so done() waits for its workers and cleanup before
   // the caller releases the memory reservation. Cleanup gets its own signal.
   let cleanupConfirmed = false;
   const uploadClient = Object.create(client) as S3Client;
   uploadClient.send = (async (command: Parameters<S3Client["send"]>[0]) => {
      const cleanup = command instanceof AbortMultipartUploadCommand;
      const result = await client.send(command, {
         abortSignal: cleanup
            ? AbortSignal.timeout(10_000)
            : abortController.signal,
      });
      if (cleanup) cleanupConfirmed = true;
      return result;
   }) as S3Client["send"];

   const upload = new Upload({
      client: uploadClient,
      params: {
         Bucket: bucket,
         Key: key,
         Body: body.pipe(limiter),
         ContentType: contentType,
         ...(contentLength === undefined
            ? {}
            : { ContentLength: contentLength }),
      },
      partSize,
      queueSize: UPLOAD_QUEUE_SIZE,
      leavePartsOnError: false,
   });

   let size = 0;
   upload.on("httpUploadProgress", ({ loaded }) => {
      if (loaded !== undefined) size = loaded;
   });

   try {
      resetIdle();
      if (abortController.signal.aborted) onAbort();
      const out = await upload.done();
      return { size, eTag: out.ETag ?? null };
   } catch (err) {
      // lib-storage cleans up worker failures, but not failures/cancellation
      // during CompleteMultipartUpload. Finish that cleanup before admission
      // is released; it must work even after the request signal was aborted.
      if (upload.uploadId !== undefined && !cleanupConfirmed) {
         try {
            await client.send(
               new AbortMultipartUploadCommand({
                  Bucket: bucket,
                  Key: key,
                  UploadId: upload.uploadId,
               }),
               { abortSignal: AbortSignal.timeout(10_000) }
            );
            cleanupConfirmed = true;
         } catch (cleanupError) {
            cleanupConfirmed =
               cleanupError instanceof Error &&
               cleanupError.name === "NoSuchUpload";
         }
         if (!cleanupConfirmed) {
            logger.warn(
               "Multipart upload failed before cleanup was confirmed",
               {
                  bucket,
                  key,
                  uploadId: upload.uploadId,
               }
            );
         }
      }
      if (isUploadTooLargeError(limiter.errored)) throw limiter.errored;
      if (abortController.signal.reason instanceof UploadIdleError)
         throw abortController.signal.reason;
      throw err;
   } finally {
      clearIdle();
      body.off("pause", clearIdle);
      body.off("resume", resetIdle);
      body.off("end", clearIdle);
      body.unpipe(limiter);
      body.off("error", onBodyError);
      abortController.signal.removeEventListener("abort", onAbort);
      limiter.destroy();
   }
};

export {
   declaredLength,
   exceedsLimit,
   exceedsMaxPartSize,
   exceedsObjectLimit,
   isUploadTooLargeError,
   MAX_DERIVED_PART_BYTES,
   MAX_OBJECT_BYTES,
   MAX_PARTS,
   maxPartBytesFor,
   partSizeFor,
   streamUpload,
   UploadTooLargeError,
   UploadIdleError,
};
