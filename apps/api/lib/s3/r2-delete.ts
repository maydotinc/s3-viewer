import { DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import type { S3DeleteResult } from "@s3-viewer/types";
import { classifyS3Error, deleteFailureMessage } from "./classify";
import type { S3Scope } from "./listing";

const R2_DELETE_CONCURRENCY = 4;
type ReviewedObject = { key: string; expectedETag: string };
type DeleteFailure = S3DeleteResult["failed"][number];
type Outcome = { key: string; failure?: DeleteFailure };

const deleteR2Object = async (
   { client, bucket, signal }: S3Scope,
   { key, expectedETag }: ReviewedObject
): Promise<Outcome> => {
   let deleteAttempted = false;
   try {
      signal?.throwIfAborted();
      const head = await client.send(
         new HeadObjectCommand({
            Bucket: bucket,
            Key: key,
            IfMatch: expectedETag,
         }),
         { abortSignal: signal }
      );
      // Check the response too in case a proxy ignores the HEAD condition.
      if (head.ETag !== expectedETag)
         return {
            key,
            failure: {
               key,
               message: deleteFailureMessage("PreconditionFailed"),
               retryable: false,
            },
         };
      signal?.throwIfAborted();
      // R2 documents conditional HEAD, but not conditional DELETE. This is an
      // ordinary key deletion after a best-effort stale-selection check. A new
      // writer between HEAD and DELETE can still be deleted; this is not an
      // atomic reviewed-version guarantee. Never send unsupported conditions
      // or replay an uncertain mutation against a newly written object.
      deleteAttempted = true;
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }), {
         abortSignal: signal,
      });
      return { key };
   } catch (error) {
      const { status, name, message } = classifyS3Error(error);
      if (status === 404 && name !== "NoSuchBucket") return { key };
      const httpStatus = (
         error as { $metadata?: { httpStatusCode?: number } } | null
      )?.$metadata?.httpStatusCode;
      const changed =
         name === "PreconditionFailed" ||
         name === "ConditionalRequestConflict" ||
         httpStatus === 412;
      return {
         key,
         failure: {
            key,
            message: changed
               ? deleteFailureMessage("PreconditionFailed")
               : deleteAttempted && status >= 500
                 ? "Deletion was not confirmed. Refresh and check this object before trying again."
                 : signal?.aborted
                   ? "Deletion was cancelled. Refresh and check this object before trying again."
                   : message,
            retryable: false,
         },
      };
   }
};

const deleteR2Keys = async (
   scope: S3Scope,
   objects: ReviewedObject[]
): Promise<S3DeleteResult> => {
   const outcomes = new Array<Outcome>(objects.length);
   let next = 0;
   await Promise.all(
      Array.from(
         { length: Math.min(R2_DELETE_CONCURRENCY, objects.length) },
         async () => {
            while (next < objects.length) {
               const index = next++;
               outcomes[index] = await deleteR2Object(scope, objects[index]!);
            }
         }
      )
   );
   const result: S3DeleteResult = { deleted: [], failed: [] };
   for (const { key, failure } of outcomes) {
      if (failure) result.failed.push(failure);
      else result.deleted.push(key);
   }
   return result;
};

export { deleteR2Keys };
