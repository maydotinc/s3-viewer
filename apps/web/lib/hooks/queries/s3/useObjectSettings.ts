import { api, objectMutationPath, qs } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { isScoped, useSessionScope } from "@/lib/stores/session-scope";
import type { S3ObjectSettings } from "@s3-viewer/types";
import { useQuery } from "@tanstack/react-query";

const useObjectSettings = (
   bucketName: string,
   objectKey: string,
   enabled = true
) => {
   const { userId, serverId } = useSessionScope();

   return useQuery({
      queryKey: queryKeys.objectSettings(
         userId,
         serverId,
         bucketName,
         objectKey
      ),
      queryFn: ({ signal }) =>
         api.get<S3ObjectSettings>(
            `${objectMutationPath(serverId, bucketName, "/settings")}${qs({ objectKey })}`,
            signal
         ),
      enabled: enabled && isScoped(userId, serverId, bucketName, objectKey),
      retry: false,
   });
};

export default useObjectSettings;
