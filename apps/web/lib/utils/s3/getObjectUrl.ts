import { createApiRequest, handleApiError } from "../api";
import { presignDownloadQuerySchema } from "@s3-viewer/types";

type ObjectUrlResponse = {
   url: string;
   type: "public" | "presigned";
   expiresIn?: number;
   message: string;
};

const getObjectUrl = async (
   bucketName: string,
   objectKey: string,
   serverId: string
): Promise<ObjectUrlResponse> => {
   const validated = presignDownloadQuerySchema.parse({
      bucketName,
      objectKey,
      serverId,
   });

   const params = new URLSearchParams(validated);

   const response = await createApiRequest(
      `/s3/object/get-url?${params}`,
      { method: "GET" }
   );

   if (!response.ok) {
      await handleApiError(response);
   }

   return await response.json();
};

export default getObjectUrl;
