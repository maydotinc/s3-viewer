import { PRESIGN_STALE_MS } from "@/lib/utils/s3/presign";
import { api, objectsPath, qs } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { isScoped, useSessionScope } from "@/lib/stores/session-scope";
import { canPresignObjectKey, type S3ObjectPreview } from "@s3-viewer/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const useObjectPreview = (
   bucketName: string,
   objectKey: string,
   enabled = true
) => {
   const queryClient = useQueryClient();
   const { userId, serverId } = useSessionScope();

   return useQuery({
      queryKey: queryKeys.objectPreview(
         userId,
         serverId,
         bucketName,
         objectKey
      ),
      queryFn: async ({ signal }) => {
         const preview = await api.get<S3ObjectPreview>(
            `${objectsPath(serverId, bucketName, "/preview-url")}${qs({ objectKey })}`,
            signal
         );
         signal.throwIfAborted();
         queryClient.setQueryData(
            queryKeys.objectSettings(userId, serverId, bucketName, objectKey),
            preview
         );
         return preview;
      },
      enabled:
         enabled &&
         isScoped(userId, serverId, bucketName, objectKey) &&
         canPresignObjectKey(objectKey),
      staleTime: PRESIGN_STALE_MS,
      gcTime: PRESIGN_STALE_MS,
      refetchInterval: PRESIGN_STALE_MS,
      refetchIntervalInBackground: false,
      // every fetch writes an object.view audit row, so only the interval refreshes the url.
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: false,
   });
};

export default useObjectPreview;
