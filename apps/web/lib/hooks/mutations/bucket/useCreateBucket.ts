import { api, serverPath } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import useSessionStore, { useUserId } from "@/lib/stores/sessionStore";
import type { S3Bucket } from "@s3-viewer/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useCreateBucket = () => {
   const queryClient = useQueryClient();
   const userId = useUserId();
   const serverId = useSessionStore((state) => state.serverId);

   return useMutation({
      mutationFn: async (bucketName: string) => {
         const { bucket } = await api.post<{ bucket: S3Bucket }>(
            `${serverPath(serverId)}/buckets`,
            { bucketName }
         );
         return bucket;
      },
      onSuccess: () =>
         queryClient.invalidateQueries({
            queryKey: queryKeys.buckets(userId, serverId),
         }),
   });
};

export default useCreateBucket;
