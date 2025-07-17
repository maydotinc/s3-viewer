import { createApiRequest, handleApiError } from "../api";

type PresignedDownloadUrlResponse = {
   url: string;
   message: string;
};

const getPresignedDownloadUrl = async (
   bucketName: string,
   objectKey: string,
   serverId: string
): Promise<PresignedDownloadUrlResponse> => {
   const params = new URLSearchParams({
      bucketName,
      objectKey,
      serverId,
   });

   const response = await createApiRequest(
      `/s3/object/presign-download?${params}`,
      {
         method: "GET",
      }
   );

   if (!response.ok) {
      await handleApiError(response);
   }

   return await response.json();
};

export default getPresignedDownloadUrl;
