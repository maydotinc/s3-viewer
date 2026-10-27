import { AbortMultipartUploadCommand } from "@aws-sdk/client-s3";
import {
   mapLimit,
   type S3AbortUploadsResult,
   type S3UploadFailure,
   type S3UploadRef,
} from "@s3-viewer/shared";
import { CLEANUP_TIMEOUT_MS } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { withDeadline } from "@/lib/utils/abort";
import { isNotFound, storageFailure } from "./classify";
import { keyHash } from "./keys";
import type { S3Scope } from "./listing";
import { forCancel, forCleanup } from "./no-retry";
import { cancellableUploadId, isUnusableUploadId } from "./upload-id";

const ABORT_CONCURRENCY = 4;

const abortUpload = async (
   { client, bucket, signal }: S3Scope,
   key: string,
   uploadId: string
): Promise<boolean> => {
   try {
      await withDeadline(signal, CLEANUP_TIMEOUT_MS, (deadline) =>
         client.send(
            new AbortMultipartUploadCommand({
               Bucket: bucket,
               Key: key,
               UploadId: uploadId,
            }),
            { abortSignal: deadline }
         )
      );
      return true;
   } catch (error) {
      if (isNotFound(error)) return false;
      throw storageFailure(error);
   }
};

const abortMultipartUpload = (
   scope: S3Scope,
   key: string,
   uploadId: string,
   retry = true
): Promise<boolean> =>
   abortUpload(
      { ...scope, client: forCancel(scope.client, retry) },
      key,
      uploadId
   );

const abortForCleanup = async (
   { client, bucket }: S3Scope,
   key: string,
   uploadId: string
): Promise<void> => {
   try {
      await abortUpload({ client: forCleanup(client), bucket }, key, uploadId);
   } catch {
      logger.warn("Multipart upload could not be aborted", {
         bucket,
         keyHash: keyHash(key),
         keyLength: key.length,
         uploadId,
      });
   }
};

const STALE_LISTING =
   "This upload can't be cancelled from this list any more. Refresh it and try again.";
const UNCANCELLABLE =
   "This upload's id is too long to cancel here. Cancel it with your storage provider's tools.";

const abortMultipartUploads = async (
   scope: S3Scope,
   serverId: string,
   uploads: readonly S3UploadRef[]
): Promise<S3AbortUploadsResult & { alreadyGone: S3UploadRef[] }> => {
   const { bucket } = scope;
   const outcomes = await mapLimit(
      uploads,
      ABORT_CONCURRENCY,
      async ({ key, uploadId }): Promise<S3UploadFailure | "gone" | null> => {
         let stored: string;
         try {
            stored = cancellableUploadId(uploadId, { serverId, bucket, key });
         } catch {
            return {
               key,
               uploadId,
               message: isUnusableUploadId(uploadId)
                  ? UNCANCELLABLE
                  : STALE_LISTING,
            };
         }
         try {
            return (await abortMultipartUpload(scope, key, stored, false))
               ? null
               : "gone";
         } catch (error) {
            return { key, uploadId, message: storageFailure(error).message };
         }
      }
   );
   const refs = (outcome: S3UploadFailure | "gone" | null): S3UploadRef[] =>
      uploads.flatMap(({ key, uploadId }, index) =>
         outcomes[index] === outcome ? [{ key, uploadId }] : []
      );
   return {
      aborted: refs(null),
      alreadyGone: refs("gone"),
      failed: outcomes.filter(
         (outcome) => outcome !== null && outcome !== "gone"
      ),
   };
};

export { abortForCleanup, abortMultipartUpload, abortMultipartUploads };
