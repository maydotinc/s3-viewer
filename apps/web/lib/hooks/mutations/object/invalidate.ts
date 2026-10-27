import { objectKeyOf, queryKeys } from "@/lib/query-keys";
import type { Query, QueryClient } from "@tanstack/react-query";

type KeyMatch = (objectKey: string) => boolean;

const noKey: KeyMatch = () => false;

const forgetObjects = (
   queryClient: QueryClient,
   userId: string,
   serverId: string,
   bucketName: string,
   changed: KeyMatch,
   removed: KeyMatch = noKey
) => {
   const touched = (keep: (objectKey: string, query: Query) => boolean) => ({
      queryKey: queryKeys.bucket(userId, serverId, bucketName),
      predicate: (query: Query) => {
         const objectKey = objectKeyOf(query.queryKey);
         return (
            objectKey !== undefined &&
            (changed(objectKey) || removed(objectKey)) &&
            keep(objectKey, query)
         );
      },
   });
   // an open view of a removed key navigates away, so refetching it would only fetch a 404
   queryClient.removeQueries(
      touched((objectKey, query) => removed(objectKey) || !query.isActive())
   );
   // removing an observed query neither notifies nor refetches it, so an open object view would keep its old ETag
   void queryClient.resetQueries(touched((objectKey) => !removed(objectKey)));
   void queryClient.invalidateQueries({
      queryKey: queryKeys.bucketSuggestions(userId, serverId, bucketName),
   });
};

const forgetKeys = (
   queryClient: QueryClient,
   userId: string,
   serverId: string,
   bucketName: string,
   objectKeys: readonly string[],
   removedKeys: readonly string[] = []
) => {
   const changed = new Set(objectKeys);
   const removed = new Set(removedKeys);
   forgetObjects(
      queryClient,
      userId,
      serverId,
      bucketName,
      (key) => changed.has(key),
      (key) => removed.has(key)
   );
};

export { forgetKeys, forgetObjects, noKey };
export type { KeyMatch };
