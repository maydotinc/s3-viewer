import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import {
   Provider,
   S3_MAX_KEYS_PER_REQUEST,
   chunk,
   observedETagSchema,
   type DeleteObjectsInput,
   type S3DeleteResult,
} from "@s3-viewer/types";
import { deleteFailureMessage } from "./classify";
import { throwHttpError } from "./errors";
import type { S3Scope } from "./listing";
import { clientProvider } from "./provider";
import { withoutRetries } from "./no-retry";
import { deleteR2Keys } from "./r2-delete";

const deleteBatch = async (
   { client, bucket, signal }: S3Scope,
   objects: { key: string; expectedETag: string }[]
): Promise<S3DeleteResult> => {
   const out = await client
      .send(
         new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: {
               Objects: objects.map(({ key, expectedETag }) => ({
                  Key: key,
                  ETag: expectedETag.slice(1, -1),
               })),
               Quiet: false,
            },
         }),
         { abortSignal: signal }
      )
      .catch(throwHttpError);
   const deleted = new Set((out.Deleted ?? []).map((entry) => entry.Key));
   const errors = new Map(
      (out.Errors ?? []).map((entry) => [
         entry.Key,
         {
            message: deleteFailureMessage(entry.Code),
            retryable:
               entry.Code !== undefined &&
               !["PreconditionFailed", "ConditionalRequestConflict"].includes(
                  entry.Code
               ),
         },
      ])
   );
   const result: S3DeleteResult = { deleted: [], failed: [] };
   for (const { key } of objects) {
      const failure = errors.get(key);
      if (!failure && deleted.has(key)) result.deleted.push(key);
      else
         result.failed.push({
            key,
            message:
               failure?.message ??
               "Storage did not confirm deletion. Refresh and check this object.",
            retryable: !deleted.has(key) && (failure?.retryable ?? false),
         });
   }
   return result;
};

const deleteKeys = async (
   scope: S3Scope,
   objects: DeleteObjectsInput["objects"]
): Promise<S3DeleteResult> => {
   const provider = await clientProvider(scope.client);
   const result: S3DeleteResult = { deleted: [], failed: [] };
   if (provider !== Provider.S3 && provider !== Provider.R2) {
      result.failed = objects.map(({ key }) => ({
         key,
         message:
            "Deletion is unavailable because this provider cannot verify that the object is still the version you reviewed. No objects were deleted.",
         retryable: false,
      }));
      return result;
   }
   const reviewed: { key: string; expectedETag: string }[] = [];
   for (const { key, expectedETag } of objects) {
      if (
         expectedETag !== null &&
         observedETagSchema.safeParse(expectedETag).success
      ) {
         reviewed.push({ key, expectedETag });
      } else {
         result.failed.push({
            key,
            message:
               "The object has no valid reviewed ETag. Refresh and review it before deleting.",
            retryable: false,
         });
      }
   }
   const once = { ...scope, client: withoutRetries(scope.client) };
   if (provider === Provider.R2) {
      const deleted = await deleteR2Keys(once, reviewed);
      result.deleted.push(...deleted.deleted);
      result.failed.push(...deleted.failed);
      return result;
   }
   for (const batch of chunk(reviewed, S3_MAX_KEYS_PER_REQUEST)) {
      const deleted = await deleteBatch(once, batch);
      result.deleted.push(...deleted.deleted);
      result.failed.push(...deleted.failed);
   }
   return result;
};

export { deleteKeys };
