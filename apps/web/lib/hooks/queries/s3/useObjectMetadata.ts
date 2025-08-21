import { createApiRequest, handleApiError } from "@/lib/utils/api";
import { S3ObjectMetadata } from "@s3-viewer/types";
import { useQuery } from "@tanstack/react-query";

const useObjectMetadata = (
   serverId: string,
   bucketName: string,
   objectKey: string
) => {
   console.log(!!serverId, !!bucketName, !!objectKey);
   console.log(serverId, bucketName, objectKey);
   return useQuery<S3ObjectMetadata>({
      queryKey: ["object-metadata", serverId, bucketName, objectKey],
      queryFn: async () => {
         const params = new URLSearchParams({
            serverId,
            bucketName,
            objectKey,
         });
         const response = await createApiRequest(
            `/s3/objects/metadata?${params}`,
            {
               method: "GET",
            }
         );

         if (!response.ok) {
            await handleApiError(response);
         }

         const data = await response.json();
         return data;
      },
      enabled: !!serverId && !!bucketName && !!objectKey,
   });
};

export default useObjectMetadata;
