import { api, objectsPath, qs } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import useSessionStore, { useUserId } from "@/lib/stores/sessionStore";
import {
   PRESIGN_EXPIRY_SECONDS,
   SECOND_MS,
   type S3ObjectMetadata,
   type S3ObjectPreview,
} from "@s3-viewer/types";
import { useQuery } from "@tanstack/react-query";

const PRESIGN_STALE_MS = 0.8 * PRESIGN_EXPIRY_SECONDS * SECOND_MS;

// the presign already heads the object, so it hands back the details too
type ObjectPreview = S3ObjectPreview & S3ObjectMetadata;

const useObjectPreview = (bucketName: string, objectKey: string) => {
   const userId = useUserId();
   const serverId = useSessionStore((state) => state.serverId);

   return useQuery({
      queryKey: queryKeys.objectPreview(
         userId,
         serverId,
         bucketName,
         objectKey
      ),
      queryFn: () =>
         api.get<ObjectPreview>(
            `${objectsPath(serverId, bucketName)}/preview-url${qs({ objectKey })}`
         ),
      enabled: Boolean(userId && serverId && bucketName && objectKey),
      staleTime: PRESIGN_STALE_MS,
      gcTime: PRESIGN_STALE_MS,
      refetchOnWindowFocus: false,
      retry: false,
   });
};

export default useObjectPreview;
