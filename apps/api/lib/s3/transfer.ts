import { GetObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { DEFAULT_CONTENT_TYPE } from "@s3-viewer/types";
import type { Readable } from "node:stream";
import {
   OBJECT_EXISTS,
   S3_ROUTE_TIMEOUT_MS,
   STREAM_IDLE_TIMEOUT_MS,
} from "@/lib/constants";
import { ApiHttpError } from "@/lib/http";
import { abortReason, noop, withDeadline } from "@/lib/utils/abort";
import {
   assertDestinationAbsent,
   conflictAs,
   enforcesConditions,
   writeCondition,
} from "./conditions";
import { throwHttpError } from "./errors";
import { headIfExists } from "./head";
import { withoutRetries } from "./no-retry";
import {
   headReviewed,
   metadataAttributes,
   sourceChangedError,
} from "./object-metadata";
import { StorageStalledError, UploadIdleError } from "./progress-floor";
import { clientProvider } from "./provider";
import {
   isUploadTooLargeError,
   streamThroughUpload,
   UPLOAD_ABORTED,
} from "./stream-upload";

const DESTINATION_CHANGED =
   "The destination changed or already exists. Refresh and try again.";

type TransferEndpoint = { client: S3Client; bucket: string; key: string };

type TransferParams = {
   source: TransferEndpoint & { expectedETag: string | null };
   destination: TransferEndpoint;
   overwrite: boolean;
   maxBytes: number;
   partSize: number;
   abortController: AbortController;
   idleTimeoutMs?: number;
};

type TransferResult = { size: number; eTag: string | null };

const transferObject = async ({
   source: sourceInput,
   destination: destinationInput,
   overwrite,
   maxBytes,
   partSize,
   abortController,
   idleTimeoutMs = STREAM_IDLE_TIMEOUT_MS,
}: TransferParams): Promise<TransferResult> => {
   const { signal } = abortController;
   const source = {
      client: withoutRetries(sourceInput.client),
      bucket: sourceInput.bucket,
      signal,
   };
   const destination = {
      client: withoutRetries(destinationInput.client),
      bucket: destinationInput.bucket,
      signal,
   };
   const { head, declared, replacing, provider, object } = await withDeadline(
      signal,
      S3_ROUTE_TIMEOUT_MS,
      async (deadline) => {
         const head = await headReviewed(
            { ...source, signal: deadline },
            sourceInput.key,
            sourceInput.expectedETag
         );
         if (head.SSECustomerAlgorithm)
            throw new ApiHttpError(
               409,
               "This object is encrypted with a customer-provided key and can't be transferred without the customer key."
            );
         const declared = head.ContentLength ?? 0;
         if (declared > maxBytes)
            throw new ApiHttpError(
               413,
               `Transfers are limited to ${maxBytes} bytes`
            );

         const existing = await headIfExists(
            { ...destination, signal: deadline },
            destinationInput.key
         );
         if (existing && !overwrite) throw new ApiHttpError(409, OBJECT_EXISTS);
         const provider = await clientProvider(destination.client);
         const object = await source.client
            .send(
               new GetObjectCommand({
                  Bucket: source.bucket,
                  Key: sourceInput.key,
                  ...(head.ETag ? { IfMatch: head.ETag } : {}),
               }),
               { abortSignal: deadline }
            )
            .catch(conflictAs(sourceChangedError));
         return {
            head,
            declared,
            replacing: overwrite ? (existing?.ETag ?? null) : null,
            provider,
            object,
         };
      }
   );
   const body = object.Body as Readable | undefined;
   if (!body) throw new ApiHttpError(502, "Storage returned no object body");

   // cancellation can precede upload setup, and destroy() can emit after upload cleanup.
   body.on("error", noop);
   const onAbort = () => body.destroy(abortReason(signal, UPLOAD_ABORTED));
   signal.addEventListener("abort", onAbort, { once: true });
   if (signal.aborted) onAbort();
   try {
      return await streamThroughUpload({
         client: destination.client,
         provider,
         bucket: destination.bucket,
         key: destinationInput.key,
         body,
         attributes: {
            ContentType: DEFAULT_CONTENT_TYPE,
            ...metadataAttributes(head),
            ...(declared ? { ContentLength: declared } : {}),
         },
         condition: writeCondition(replacing ?? undefined),
         partSize,
         maxBytes,
         abortController,
         idleTimeoutMs,
         conflictMessage: DESTINATION_CHANGED,
         beforeCommit: async () => {
            if (enforcesConditions(provider)) return;
            if (replacing === null)
               await assertDestinationAbsent(
                  destination,
                  destinationInput.key,
                  DESTINATION_CHANGED
               );
            else if (
               (await headIfExists(destination, destinationInput.key))?.ETag !==
               replacing
            )
               throw new ApiHttpError(409, DESTINATION_CHANGED);
         },
      });
   } catch (error) {
      if (
         error instanceof UploadIdleError ||
         error instanceof StorageStalledError ||
         isUploadTooLargeError(error)
      )
         throw error;
      return throwHttpError(error);
   } finally {
      signal.removeEventListener("abort", onAbort);
      if (body.closed) {
         body.off("error", noop);
      } else {
         body.once("close", () => body.off("error", noop));
         body.destroy();
      }
   }
};

export { transferObject };
