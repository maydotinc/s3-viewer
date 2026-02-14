import { createApiRequest, handleApiError } from "@/lib/utils/api";
import { presignUploadQuerySchema } from "@s3-viewer/types";

interface PresignedUploadUrlResponse {
   url: string;
   message: string;
}

const getPresignedUploadUrl = async (
   bucketName: string,
   objectKey: string,
   contentType: string,
   serverId: string
): Promise<PresignedUploadUrlResponse> => {
   const validated = presignUploadQuerySchema.parse({
      bucketName,
      objectKey,
      contentType,
      serverId,
   });

   const params = new URLSearchParams(validated);

   const response = await createApiRequest(
      `/s3/object/presign-upload?${params}`,
      { method: "GET" }
   );

   if (!response.ok) {
      await handleApiError(response);
   }

   return await response.json();
};

export default getPresignedUploadUrl;
