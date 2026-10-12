import type { S3Client } from "@aws-sdk/client-s3";
import { MAX_MULTIPART_PARTS, MAX_OBJECT_BYTES } from "@s3-viewer/types";
import type { Readable } from "node:stream";
import {
   S3_ROUTE_TIMEOUT_MS,
   STREAM_IDLE_TIMEOUT_MS,
   UPLOAD_CONFLICT,
} from "@/lib/constants";
import { env } from "@/lib/env";
import { ApiHttpError } from "@/lib/http";
import { withDeadline } from "@/lib/utils/abort";
import {
   assertDestinationAbsent,
   enforcesConditions,
   writeCondition,
} from "./conditions";
import { uploadTooLarge } from "./errors";
import { withoutRetries } from "./no-retry";
import { exceedsMaxPartSize, maxPartBytesFor, partSizeFor } from "./part-size";
import { clientProvider } from "./provider";
import {
   assertReplacementUnchanged,
   prepareUpload,
   readReplacementSettings,
} from "./replacement-settings";
import { streamThroughUpload } from "./stream-upload";

const declaredLength = (header: string | undefined): number | undefined => {
   if (header === undefined || header.trim() === "") return undefined;
   const length = Number(header);
   return Number.isSafeInteger(length) && length >= 0 ? length : undefined;
};

const exceedsLimit = (
   length: number | undefined,
   limit: number | undefined
): boolean => limit !== undefined && length !== undefined && length > limit;

const plannedPartSize = (totalBytes: number | undefined): number => {
   if (exceedsLimit(totalBytes, env.MAX_UPLOAD_BYTES))
      throw uploadTooLarge(env.MAX_UPLOAD_BYTES);
   if (exceedsLimit(totalBytes, MAX_OBJECT_BYTES))
      throw uploadTooLarge(MAX_OBJECT_BYTES);
   const maxPartBytes = maxPartBytesFor(env.UPLOAD_PART_BYTES);
   if (exceedsMaxPartSize(totalBytes, maxPartBytes))
      throw new ApiHttpError(
         413,
         `Uploads over ${MAX_MULTIPART_PARTS * maxPartBytes} bytes need a larger UPLOAD_PART_BYTES`
      );
   return partSizeFor(totalBytes, env.UPLOAD_PART_BYTES);
};

const streamedUploadCap = (partSize: number): number =>
   Math.min(
      env.MAX_UPLOAD_BYTES,
      MAX_MULTIPART_PARTS * partSize,
      MAX_OBJECT_BYTES
   );

type StreamUploadParams = {
   client: S3Client;
   bucket: string;
   key: string;
   contentType: string;
   expectedETag?: string;
   body: Readable;
   contentLength: number | undefined;
   partSize: number;
   maxBytes: number;
   abortController: AbortController;
   idleTimeoutMs?: number;
};

type StreamUploadResult = { size: number; eTag: string | null };

const runStreamUpload = async ({
   client,
   bucket,
   key,
   contentType,
   expectedETag,
   body,
   contentLength,
   partSize,
   maxBytes,
   abortController,
   idleTimeoutMs = STREAM_IDLE_TIMEOUT_MS,
}: StreamUploadParams): Promise<StreamUploadResult> => {
   const provider = await clientProvider(client);
   const scope = {
      client: withoutRetries(client),
      bucket,
      signal: abortController.signal,
   };
   const { settings, attributes } = await withDeadline(
      abortController.signal,
      S3_ROUTE_TIMEOUT_MS,
      (signal) =>
         prepareUpload({ ...scope, signal }, provider, {
            key,
            contentType,
            expectedETag,
         })
   );
   return streamThroughUpload({
      client,
      provider,
      bucket,
      key,
      body,
      attributes: {
         ...attributes,
         ...(contentLength === undefined
            ? {}
            : { ContentLength: contentLength }),
      },
      condition: writeCondition(expectedETag),
      partSize,
      maxBytes,
      abortController,
      idleTimeoutMs,
      conflictMessage: UPLOAD_CONFLICT,
      beforeCommit: async () => {
         if (settings && expectedETag !== undefined)
            assertReplacementUnchanged(
               settings,
               await readReplacementSettings(scope, key, expectedETag)
            );
         else if (!enforcesConditions(provider))
            await assertDestinationAbsent(scope, key, UPLOAD_CONFLICT);
      },
   });
};

const streamUpload = async (
   params: StreamUploadParams
): Promise<StreamUploadResult> => {
   // disconnects can emit errors during replacement preflight, before the pipeline attaches listeners.
   const onInputError = (error: Error) => params.abortController.abort(error);
   params.body.on("error", onInputError);
   try {
      return await runStreamUpload(params);
   } finally {
      params.body.off("error", onInputError);
   }
};

export { declaredLength, plannedPartSize, streamedUploadCap, streamUpload };
