import { api, objectsPath } from "@/lib/api";
import useSessionStore, { useUserId } from "@/lib/stores/sessionStore";
import type { S3DeleteResult } from "@s3-viewer/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { forgetObjects } from "./invalidate";
import { reportDeleteResult } from "./useDeleteObjects";

const useDeletePrefix = () => {
   const queryClient = useQueryClient();
   const userId = useUserId();
   const serverId = useSessionStore((state) => state.serverId);

   return useMutation({
      mutationFn: ({
         bucketName,
         prefix,
      }: {
         bucketName: string;
         prefix: string;
      }) =>
         api.delete<S3DeleteResult>(
            `${objectsPath(serverId, bucketName)}/prefix`,
            { prefix }
         ),
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

export default useDeletePrefix;
