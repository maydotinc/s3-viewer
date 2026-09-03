import { queryKeys } from "@/lib/queryKeys";
import type { QueryClient } from "@tanstack/react-query";

const forgetObjects = (
   queryClient: QueryClient,
   userId: string,
   serverId: string,
   bucketName: string,
   objectKeys: readonly string[]
) => {
   for (const objectKey of objectKeys) {
      queryClient.removeQueries({
         queryKey: queryKeys.objectMetadata(
            userId,
            serverId,
            bucketName,
            objectKey
         ),
      });
      queryClient.removeQueries({
         queryKey: queryKeys.objectPreview(
            userId,
            serverId,
            bucketName,
            objectKey
         ),
      });
   }
   void queryClient.invalidateQueries({
      queryKey: queryKeys.bucketObjects(userId, serverId, bucketName),
   });
};

export { forgetObjects };
