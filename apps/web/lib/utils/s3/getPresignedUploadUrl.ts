import { createApiRequest, handleApiError } from "@/lib/utils/api";

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
   const params = new URLSearchParams({
      bucketName,
      objectKey,
      contentType,
      serverId,
   });

   const response = await createApiRequest(
      `/s3/object/presign-upload?${params}`,
      {
         method: "GET",
      }
   );

   if (!response.ok) {
      await handleApiError(response);
   }

   return await response.json();
};

export default getPresignedUploadUrl;
