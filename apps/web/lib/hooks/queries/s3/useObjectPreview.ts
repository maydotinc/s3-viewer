import { createApiRequest, handleApiError } from "@/lib/utils/api";
import { isPreviewable } from "@/lib/utils/s3/previewHelpers";
import { previewQuerySchema, S3ObjectPreviewResponse } from "@s3-viewer/types";
import { useQuery } from "@tanstack/react-query";

const useObjectPreview = (
   serverId: string,
   bucketName: string,
   objectKey: string,
   contentType?: string
) => {
   const previewable = isPreviewable(contentType);

   return useQuery<S3ObjectPreviewResponse>({
      queryKey: ["object-preview", serverId, bucketName, objectKey],
      queryFn: async () => {
         const validated = previewQuerySchema.parse({
            serverId,
            bucketName,
            objectKey,
            contentType: contentType || "",
         });
         const params = new URLSearchParams(validated);

         const response = await createApiRequest(
            `/s3/object/preview?${params}`,
            {
               method: "GET",
            }
         );

         if (!response.ok) {
            await handleApiError(response);
         }

         return response.json();
      },
      enabled: !!serverId && !!bucketName && !!objectKey && previewable,
   });
};

export default useObjectPreview;
