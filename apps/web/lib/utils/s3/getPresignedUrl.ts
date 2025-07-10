import { createApiRequest, handleApiError } from "@/lib/utils/api";

interface PresignedUploadResponse {
   url: string;
   message: string;
}

const getPresignedUrl = async (
   bucketName: string,
   objectKey: string,
   contentType: string,
   serverId: string
): Promise<PresignedUploadResponse> => {
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

export default getPresignedUrl;
