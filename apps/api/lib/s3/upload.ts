import type { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { Transform, type Readable } from "node:stream";
import { logger } from "../logger";

const QUEUE_SIZE = 4;
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

const isUploadTooLargeError = (err: unknown): err is UploadTooLargeError =>
   err instanceof UploadTooLargeError;

const limitBytes = (limit: number): Transform => {
   let total = 0;
   return new Transform({
      transform(chunk, _encoding, done) {
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
}: StreamUploadParams): Promise<StreamUploadResult> => {
   const limiter = limitBytes(maxBytes);
   body.on("error", (err) => limiter.destroy(err));
   limiter.on("error", () => body.destroy());

   const upload = new Upload({
      client,
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
      queueSize: QUEUE_SIZE,
      leavePartsOnError: false,
      abortController,
   });

   let size = 0;
   upload.on("httpUploadProgress", ({ loaded }) => {
      if (loaded !== undefined) size = loaded;
   });

   try {
      const out = await upload.done();
      return { size, eTag: out.ETag ?? null };
   } catch (err) {
      // done() races the abort, so the AbortMultipartUpload may still be in
      // flight here; log the id so an operator can clean up orphaned parts
      if (upload.uploadId !== undefined) {
         logger.warn("Multipart upload failed before cleanup was confirmed", {
            bucket,
            key,
            uploadId: upload.uploadId,
         });
      }
      if (isUploadTooLargeError(limiter.errored)) throw limiter.errored;
      throw err;
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
};
