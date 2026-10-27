import { api, objectsPath } from "@/lib/api";
import type { BucketTarget } from "@/lib/types";
import {
   answerFrom,
   reportBatchResult,
   runBatched,
   type BatchFailure,
   type BatchSummary,
} from "@/lib/utils/s3/batch";
import {
   MAX_BATCH_KEYS,
   OBJECT_MUTATION_PATH,
   observedETagSchema,
   type S3DeleteResult,
   type S3DeleteTarget,
} from "@s3-viewer/shared";
import useObjectMutation, {
   confirmedTargets,
   forgetTouched,
} from "./useObjectMutation";

type DeleteSummary = BatchSummary<BatchFailure<S3DeleteTarget>>;

const keyOf = ({ key }: S3DeleteTarget) => key;

const deleteObjects = async (
   path: string,
   objects: readonly S3DeleteTarget[],
   userId: string,
   signal?: AbortSignal
): Promise<DeleteSummary> => {
   const invalid: BatchFailure<S3DeleteTarget>[] = [];
   const unique = new Map(
      objects.map(({ key, expectedETag }) => [
         key,
         { key, expectedETag: expectedETag ?? null },
      ])
   );
   const valid: S3DeleteTarget[] = [];
   for (const object of unique.values()) {
      if (
         object.expectedETag === null ||
         observedETagSchema.safeParse(object.expectedETag).success
      )
         valid.push(object);
      else
         invalid.push({
            ...object,
            message:
               "The object has an invalid ETag. Refresh and review it before deleting.",
            retryable: false,
         });
   }
   const outcome = await runBatched<S3DeleteTarget, S3DeleteResult>({
      targets: valid,
      targetId: ({ key }) => key,
      limit: MAX_BATCH_KEYS,
      send: (batch) =>
         api.delete<S3DeleteResult>(
            `${path}${OBJECT_MUTATION_PATH}`,
            { objects: batch, expectedUserId: userId },
            signal
         ),
      answer: (result) =>
         answerFrom(result.deleted, result.failed, ({ key }) => key),
      unconfirmedMessage:
         "Storage did not confirm deletion. Refresh and check this object.",
      transportFailureSuffix:
         "Close this dialog and refresh before deleting this object again.",
      signal,
   });
   return { ...outcome, failed: [...invalid, ...outcome.failed] };
};

const reportDeleteResult = (summary: DeleteSummary) =>
   reportBatchResult(summary, {
      pastTenseVerb: "deleted",
      incomplete: "Deletion is incomplete",
   });

const useDeleteObjects = () =>
   useObjectMutation({
      mutationFn: ({
         userId,
         serverId,
         bucketName,
         objects,
         signal,
      }: BucketTarget & {
         objects: S3DeleteTarget[];
         signal?: AbortSignal;
      }) =>
         deleteObjects(
            objectsPath(serverId, bucketName),
            objects,
            userId,
            signal
         ),
      onSuccess: reportDeleteResult,
      settle: forgetTouched(({ objects }, outcome) => {
         const { confirmed, unconfirmed } = confirmedTargets(
            objects,
            keyOf,
            outcome
         );
         return {
            changed: unconfirmed.map(keyOf),
            removed: confirmed.map(keyOf),
         };
      }),
   });

export default useDeleteObjects;
export { deleteObjects, reportDeleteResult };
export type { DeleteSummary };
