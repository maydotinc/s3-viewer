import { api, objectsPath, qs } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import useSessionStore, { useUserId } from "@/lib/stores/sessionStore";
import { SECOND_MS, type S3ObjectListPage } from "@s3-viewer/types";
import { useQuery } from "@tanstack/react-query";

const SUGGESTION_BLOCK_SIZE = 50;

const useObjectKeys = (
   bucketName: string,
   prefix: string,
   enabled: boolean
) => {
   const userId = useUserId();
   const serverId = useSessionStore((state) => state.serverId);

   const query = useQuery({
      queryKey: queryKeys.objects(userId, serverId, bucketName, prefix),
      queryFn: async () => {
         const page = await api.get<S3ObjectListPage>(
            `${objectsPath(serverId, bucketName)}${qs({
               prefix,
               blockSize: SUGGESTION_BLOCK_SIZE,
            })}`
         );
         return page.objects.map((object) => object.key);
      },
      enabled: enabled && Boolean(userId && serverId && bucketName),
      staleTime: 30 * SECOND_MS,
      retry: false,
   });

   return query.data ?? [];
};

export default useObjectKeys;
