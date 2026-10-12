import { api, objectsPath, qs } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { isScoped, useSessionScope } from "@/lib/stores/session-scope";
import { canListPrefix } from "@/lib/utils/folder-access";
import { SECOND_MS, type S3ObjectListPage } from "@s3-viewer/types";
import { useQuery } from "@tanstack/react-query";
import useBucketScope from "./useBucketScope";

const SUGGESTION_BLOCK_SIZE = 50;
const NO_KEYS: string[] = [];

type SuggestionScope = { userId: string; serverId: string };

const useObjectKeys = (
   bucketName: string,
   prefix: string,
   enabled: boolean,
   scope?: SuggestionScope,
   cacheOnly = false
) => {
   const session = useSessionScope();
   const { userId, serverId } = scope ?? session;
   const reach = useBucketScope(userId, serverId, bucketName);
   const listable = canListPrefix(reach, prefix);

   const query = useQuery({
      queryKey: queryKeys.objectKeySuggestions(
         userId,
         serverId,
         bucketName,
         prefix
      ),
      queryFn: async ({ signal }) => {
         const page = await api.get<S3ObjectListPage>(
            `${objectsPath(serverId, bucketName)}${qs({
               prefix,
               blockSize: SUGGESTION_BLOCK_SIZE,
            })}`,
            signal
         );
         return page.objects.map((object) => object.key);
      },
      enabled:
         !cacheOnly &&
         enabled &&
         listable &&
         isScoped(userId, serverId, bucketName),
      staleTime: 30 * SECOND_MS,
      retry: false,
   });

   return query.data ?? NO_KEYS;
};

export default useObjectKeys;
export type { SuggestionScope };
