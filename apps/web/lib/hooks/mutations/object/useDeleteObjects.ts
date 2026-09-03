import { api, isAborted, objectsPath } from "@/lib/api";
import useSessionStore, { useUserId } from "@/lib/stores/sessionStore";
import {
   MAX_BATCH_KEYS,
   MAX_BATCH_KEY_CHARS,
   chunkKeys,
   type S3DeleteResult,
} from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { forgetKeys } from "./invalidate";

const MAX_LISTED_FAILURES = 100;

type DeleteSummary = {
   deleted: number;
   failedTotal: number;
   failed: S3DeleteResult["failed"];
};

const emptySummary = (): DeleteSummary => ({
   deleted: 0,
   failedTotal: 0,
   failed: [],
});

const addPage = (summary: DeleteSummary, page: S3DeleteResult) => {
   summary.deleted += page.deleted.length;
   summary.failedTotal += page.failed.length;
   summary.failed.push(
      ...page.failed.slice(0, MAX_LISTED_FAILURES - summary.failed.length)
   );
};

const reportDeleteResult = ({
   deleted,
   failedTotal,
   failed,
}: DeleteSummary) => {
   if (failedTotal > 0) {
      const names = failed
         .slice(0, 3)
         .map((f) => f.key)
         .join(", ");
      const more = failedTotal > 3 ? ` and ${failedTotal - 3} more` : "";
      toast.error("Some objects couldn't be deleted", {
         description: `${deleted} deleted, ${failedTotal} failed: ${names}${more}`,
      });
   } else if (deleted > 0) {
      toast.success(
         deleted === 1 ? "1 object deleted." : `${deleted} objects deleted.`
      );
   }
};

const useDeleteObjects = () => {
   const queryClient = useQueryClient();
   const userId = useUserId();
   const serverId = useSessionStore((state) => state.serverId);

   return useMutation({
      mutationFn: async ({
         bucketName,
         objectKeys,
         signal,
      }: {
         bucketName: string;
         objectKeys: string[];
         signal?: AbortSignal;
      }): Promise<DeleteSummary> => {
         const summary = emptySummary();
         for (const batch of chunkKeys(
            objectKeys,
            MAX_BATCH_KEYS,
            MAX_BATCH_KEY_CHARS
         )) {
            if (signal?.aborted) break;
            try {
               addPage(
                  summary,
                  await api.delete<S3DeleteResult>(
                     objectsPath(serverId, bucketName),
                     { objectKeys: batch },
                     signal
                  )
               );
            } catch (error) {
               if (isAborted(error)) break;
               throw error;
            }
         }
         return summary;
      },
      onSuccess: (result, { bucketName, objectKeys }) => {
         reportDeleteResult(result);
         forgetKeys(queryClient, userId, serverId, bucketName, objectKeys);
      },
   });
};

export default useDeleteObjects;
export { addPage, emptySummary, reportDeleteResult };
export type { DeleteSummary };
