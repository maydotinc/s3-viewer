import {
   api,
   cancelledError,
   errorMessage,
   isAborted,
   objectsPath,
} from "@/lib/api";
import {
   MAX_BATCH_KEYS,
   OBJECT_MUTATION_PATH,
   MAX_BATCH_KEY_CHARS,
   chunkKeys,
   observedETagSchema,
   type S3DeleteResult,
   type S3DeleteTarget,
} from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { forgetKeys } from "./invalidate";

type DeleteSummary = {
   deleted: number;
   failedTotal: number;
   failed: (S3DeleteTarget & { message: string; retryable: boolean })[];
   listingError: string | null;
   /** the run stopped early, so objects it never reached may still be there. */
   remaining: boolean;
};

const emptySummary = (): DeleteSummary => ({
   deleted: 0,
   failedTotal: 0,
   failed: [],
   listingError: null,
   remaining: false,
});

const addPage = (summary: DeleteSummary, page: DeleteSummary) => {
   summary.deleted += page.deleted;
   summary.failed.push(...page.failed);
   summary.failedTotal = summary.failed.length;
   summary.listingError ??= page.listingError;
   summary.remaining ||= page.remaining;
};

const deleteObjects = async (
   path: string,
   objects: readonly S3DeleteTarget[],
   userId: string,
   signal?: AbortSignal
): Promise<DeleteSummary> => {
   const summary = emptySummary();
   const targets = new Map(
      objects.map(({ key, expectedETag }) => [
         key,
         { key, expectedETag: expectedETag ?? null },
      ])
   );
   const valid: S3DeleteTarget[] = [];
   for (const object of targets.values()) {
      if (
         object.expectedETag === null ||
         observedETagSchema.safeParse(object.expectedETag).success
      )
         valid.push(object);
      else
         summary.failed.push({
            ...object,
            message:
               "The object has an invalid ETag. Refresh and review it before deleting.",
            retryable: false,
         });
   }
   for (const keys of chunkKeys(
      valid.map(({ key }) => key),
      MAX_BATCH_KEYS,
      MAX_BATCH_KEY_CHARS
   )) {
      if (signal?.aborted) throw cancelledError();
      const batch = keys.map((key) => targets.get(key)!);
      try {
         const result = await api.delete<S3DeleteResult>(
            `${path}${OBJECT_MUTATION_PATH}`,
            { objects: batch, expectedUserId: userId },
            signal
         );
         const deleted = new Set(result.deleted);
         const errors = new Map(
            result.failed.map((failure) => [failure.key, failure])
         );
         for (const object of batch) {
            const failure = errors.get(object.key);
            if (!failure && deleted.has(object.key)) summary.deleted++;
            else
               summary.failed.push({
                  ...object,
                  message:
                     failure?.message ??
                     "Storage did not confirm deletion. Refresh and check this object.",
                  retryable:
                     !deleted.has(object.key) && failure?.retryable === true,
               });
         }
      } catch (error) {
         if (isAborted(error)) throw error;
         summary.failed.push(
            ...batch.map((object) => ({
               ...object,
               message: `${errorMessage(error)} Close this dialog and refresh before deleting this object again.`,
               retryable: false,
            }))
         );
      }
   }
   summary.failedTotal = summary.failed.length;
   return summary;
};

const reportDeleteResult = ({
   deleted,
   failedTotal,
   failed,
   listingError,
   remaining,
}: DeleteSummary) => {
   if (failedTotal === 0 && !listingError && !remaining) {
      if (deleted > 0)
         toast.success(
            deleted === 1 ? "1 object deleted." : `${deleted} objects deleted.`
         );
      return;
   }
   const names = failed
      .slice(0, 3)
      .map((f) => f.key)
      .join(", ");
   const more = failedTotal > 3 ? ` and ${failedTotal - 3} more` : "";
   const left = remaining ? " More objects remain." : "";
   toast.error("Deletion is incomplete", {
      description:
         listingError ??
         `${deleted} deleted, ${failedTotal} failed: ${names}${more}.${left}`,
   });
};

const useDeleteObjects = () => {
   const queryClient = useQueryClient();
   return useMutation({
      mutationFn: ({
         userId,
         serverId,
         bucketName,
         objects,
         signal,
      }: {
         userId: string;
         serverId: string;
         bucketName: string;
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
      onSettled: (_result, _error, { userId, serverId, bucketName, objects }) =>
         forgetKeys(
            queryClient,
            userId,
            serverId,
            bucketName,
            objects.map(({ key }) => key)
         ),
   });
};

export default useDeleteObjects;
export { addPage, deleteObjects, emptySummary, reportDeleteResult };
export type { DeleteSummary };
