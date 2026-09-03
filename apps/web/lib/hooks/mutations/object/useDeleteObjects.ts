import { api, objectsPath } from "@/lib/api";
import useSessionStore, { useUserId } from "@/lib/stores/sessionStore";
import { MAX_DELETE_KEYS, chunk, type S3DeleteResult } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { forgetObjects } from "./invalidate";

const reportDeleteResult = ({ deleted, failed }: S3DeleteResult) => {
   if (failed.length > 0) {
      const names = failed
         .slice(0, 3)
         .map((f) => f.key)
         .join(", ");
      const more = failed.length > 3 ? ` and ${failed.length - 3} more` : "";
      toast.error("Some objects couldn't be deleted", {
         description: `${deleted.length} deleted, ${failed.length} failed: ${names}${more}`,
      });
   } else if (deleted.length > 0) {
      toast.success(
         deleted.length === 1
            ? "1 object deleted."
            : `${deleted.length} objects deleted.`
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
      }: {
         bucketName: string;
         objectKeys: string[];
      }): Promise<S3DeleteResult> => {
         const result: S3DeleteResult = { deleted: [], failed: [] };
         for (const batch of chunk(objectKeys, MAX_DELETE_KEYS)) {
            const page = await api.delete<S3DeleteResult>(
               objectsPath(serverId, bucketName),
               { objectKeys: batch }
            );
            result.deleted.push(...page.deleted);
            result.failed.push(...page.failed);
         }
         return result;
      },
      onSuccess: (result, { bucketName }) => {
         reportDeleteResult(result);
         forgetObjects(
            queryClient,
            userId,
            serverId,
            bucketName,
            result.deleted
         );
      },
   });
};

export default useDeleteObjects;
export { reportDeleteResult };
