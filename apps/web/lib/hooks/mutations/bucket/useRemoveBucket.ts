import { api, bucketPath } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import useSessionStore, { useUserId } from "@/lib/stores/sessionStore";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useRemoveBucket = () => {
   const queryClient = useQueryClient();
   const userId = useUserId();
   const serverId = useSessionStore((state) => state.serverId);

   return useMutation({
      mutationFn: (bucketName: string) =>
         api.delete<void>(bucketPath(serverId, bucketName)),
      onSuccess: (_, bucketName) => {
         queryClient.removeQueries({
            queryKey: queryKeys.bucket(userId, serverId, bucketName),
         });
         void queryClient.invalidateQueries({
            queryKey: queryKeys.buckets(userId, serverId),
         });
      },
   });
};

export default useRemoveBucket;
