import type { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import type { Readable } from "node:stream";

const QUEUE_SIZE = 4;
const MAX_PARTS = 10_000;
const TIB = 1024 ** 4;
const MAX_OBJECT_BYTES = 5 * TIB;

const declaredLength = (header: string | undefined): number | undefined => {
   if (header === undefined || header.trim() === "") return undefined;
   const length = Number(header);
   return Number.isSafeInteger(length) && length >= 0 ? length : undefined;
};

const exceedsLimit = (
   length: number | undefined,
   limit: number | undefined
): boolean => limit !== undefined && length !== undefined && length > limit;

/** The smallest part size that keeps a known content length under `MAX_PARTS`. */
const minPartSizeFor = (contentLength: number): number =>
   Math.ceil(contentLength / MAX_PARTS);

/** True when `length` exceeds S3's per-object limit, or even `maxPartBytes` parts can't fit it under `MAX_PARTS`. */
const exceedsMaxPartSize = (
   length: number | undefined,
   maxPartBytes: number
): boolean =>
   length !== undefined &&
   (length > MAX_OBJECT_BYTES || minPartSizeFor(length) > maxPartBytes);

/** Base part size, bumped up so a known content length stays under `MAX_PARTS` parts. */
const partSizeFor = (
   contentLength: number | undefined,
   basePartBytes: number
): number =>
   contentLength === undefined
      ? basePartBytes
      : Math.max(basePartBytes, minPartSizeFor(contentLength));

type StreamUploadParams = {
   client: S3Client;
   bucket: string;
   key: string;
   contentType: string;
   body: Readable;
   contentLength: number | undefined;
   partSize: number;
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
   abortController,
}: StreamUploadParams): Promise<StreamUploadResult> => {
   const upload = new Upload({
      client,
      params: {
         Bucket: bucket,
         Key: key,
         Body: body,
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

   const out = await upload.done();
   return { size, eTag: out.ETag ?? null };
};

export {
   declaredLength,
   exceedsLimit,
   exceedsMaxPartSize,
   MAX_OBJECT_BYTES,
   MAX_PARTS,
   partSizeFor,
   streamUpload,
};
