import type { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import type { Readable } from "node:stream";

const PART_SIZE = 25 * 1024 * 1024;
const QUEUE_SIZE = 4;

const declaredLength = (header: string | undefined): number | undefined => {
   if (header === undefined || header.trim() === "") return undefined;
   const length = Number(header);
   return Number.isSafeInteger(length) && length >= 0 ? length : undefined;
};

const exceedsLimit = (
   length: number | undefined,
   limit: number | undefined
): boolean => limit !== undefined && length !== undefined && length > limit;

type StreamUploadParams = {
   client: S3Client;
   bucket: string;
   key: string;
   contentType: string;
   body: Readable;
   contentLength: number | undefined;
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
      partSize: PART_SIZE,
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

export { declaredLength, exceedsLimit, streamUpload };
