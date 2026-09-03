import { api, objectsPath, qs } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import useSessionStore, { useUserId } from "@/lib/stores/sessionStore";
import type { S3ObjectMetadata } from "@s3-viewer/types";
import { useQuery } from "@tanstack/react-query";

const useObjectMetadata = (bucketName: string, objectKey: string) => {
   const userId = useUserId();
   const serverId = useSessionStore((state) => state.serverId);

   return useQuery({
      queryKey: queryKeys.objectMetadata(
         userId,
         serverId,
         bucketName,
         objectKey
      ),
      queryFn: () =>
         api.get<S3ObjectMetadata>(
            `${objectsPath(serverId, bucketName)}/metadata${qs({ objectKey })}`
         ),
      enabled: Boolean(userId && serverId && bucketName && objectKey),
      retry: false,
   });
};

export default useObjectMetadata;
