import { objectKeyOf, queryKeys } from "@/lib/query-keys";
import type { QueryClient } from "@tanstack/react-query";

const forgetObjects = (
   queryClient: QueryClient,
   userId: string,
   serverId: string,
   bucketName: string,
   matches: (objectKey: string) => boolean
) => {
   queryClient.removeQueries({
      queryKey: queryKeys.bucket(userId, serverId, bucketName),
      predicate: ({ queryKey }) => {
         const objectKey = objectKeyOf(queryKey);
         return objectKey !== undefined && matches(objectKey);
      },
   });
   void queryClient.invalidateQueries({
      queryKey: queryKeys.bucketSuggestions(userId, serverId, bucketName),
   });
};

const forgetKeys = (
   queryClient: QueryClient,
   userId: string,
   serverId: string,
   bucketName: string,
   objectKeys: readonly string[]
) => {
   const keys = new Set(objectKeys);
   forgetObjects(queryClient, userId, serverId, bucketName, (key) =>
      keys.has(key)
   );
};

export { forgetKeys, forgetObjects };
