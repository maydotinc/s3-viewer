import { createApiRequest, handleApiError } from "../api";
import { presignDownloadQuerySchema } from "@s3-viewer/types";

type PresignedDownloadUrlResponse = {
   url: string;
   message: string;
};

const getPresignedDownloadUrl = async (
   bucketName: string,
   objectKey: string,
   serverId: string
): Promise<PresignedDownloadUrlResponse> => {
   const validated = presignDownloadQuerySchema.parse({
      bucketName,
      objectKey,
      serverId,
   });

   const params = new URLSearchParams(validated);

   const response = await createApiRequest(
      `/s3/object/presign-download?${params}`,
      { method: "GET" }
   );

   if (!response.ok) {
      await handleApiError(response);
   }

   return await response.json();
};

export default getPresignedDownloadUrl;
