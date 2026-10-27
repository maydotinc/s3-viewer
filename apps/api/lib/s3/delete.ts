import {
   Provider,
   mapLimit,
   observedETagSchema,
   type DeleteObjectsInput,
   type S3DeleteResult,
   type S3DeleteTarget,
} from "@s3-viewer/shared";
import { HEAD_CONCURRENCY } from "@/lib/constants";
import {
   deleteCheckedKeys,
   deleteTargets,
   objectMissing,
   type Outcome,
} from "./checked-delete";
import { classifyS3Error } from "./classify";
import { refusedFailure } from "./errors";
import { sendHead } from "./head";
import type { S3Scope } from "./listing";
import { clientProvider } from "./provider";
import { withoutRetries } from "./no-retry";

type Reviewed = { key: string; expectedETag: string };
type DeleteKeysResult = S3DeleteResult & { alreadyGone: string[] };

const resolveETag = async (
   scope: S3Scope,
   key: string
): Promise<Outcome | Reviewed> => {
   try {
      scope.signal?.throwIfAborted();
      const head = await sendHead(scope, key);
      if (head.ETag) return { key, expectedETag: head.ETag };
   } catch (error) {
      if (objectMissing(error)) return { key, gone: true };
      return {
         key,
         failure: refusedFailure(error, key) ?? {
            key,
            message: classifyS3Error(error).message,
            retryable: false,
         },
      };
   }
   return {
      key,
      failure: {
         key,
         message:
            "Storage did not report this object's current version. Refresh and try again.",
         retryable: false,
      },
   };
};

const deleteConditionally = async (
   scope: S3Scope,
   objects: readonly S3DeleteTarget[]
): Promise<Outcome[]> => {
   const resolved = await mapLimit(
      objects,
      HEAD_CONCURRENCY,
      async ({ key, expectedETag }) =>
         expectedETag === null ? resolveETag(scope, key) : { key, expectedETag }
   );
   const outcomes: Outcome[] = [];
   const reviewed: Reviewed[] = [];
   for (const entry of resolved) {
      if ("expectedETag" in entry) reviewed.push(entry);
      else outcomes.push(entry);
   }
   return [...outcomes, ...(await deleteTargets(scope, reviewed))];
};

const deleteKeys = async (
   scope: S3Scope,
   objects: DeleteObjectsInput["objects"]
): Promise<DeleteKeysResult> => {
   const provider = await clientProvider(scope.client);
   const outcomes: Outcome[] = [];
   const reviewed: S3DeleteTarget[] = [];
   for (const { key, expectedETag } of objects) {
      if (
         expectedETag === null ||
         observedETagSchema.safeParse(expectedETag).success
      ) {
         reviewed.push({ key, expectedETag });
      } else {
         outcomes.push({
            key,
            failure: {
               key,
               message:
                  "The object has no valid reviewed ETag. Refresh and review it before deleting.",
               retryable: false,
            },
         });
      }
   }
   const once = { ...scope, client: withoutRetries(scope.client) };
   outcomes.push(
      ...(provider === Provider.S3
         ? await deleteConditionally(once, reviewed)
         : await deleteCheckedKeys(once, reviewed))
   );
   const result: DeleteKeysResult = {
      deleted: [],
      alreadyGone: [],
      failed: [],
   };
   for (const { key, failure, gone } of outcomes) {
      if (failure) result.failed.push(failure);
      else (gone ? result.alreadyGone : result.deleted).push(key);
   }
   return result;
};

export { deleteKeys };
