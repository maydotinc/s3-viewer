import { ApiError, api, objectsPath, qs } from "@/lib/api";
import type { S3ObjectMetadata, S3PresignedUrl } from "@s3-viewer/types";

const getDownloadUrl = (
   serverId: string,
   bucketName: string,
   objectKey: string
) =>
   api.get<S3PresignedUrl>(
      `${objectsPath(serverId, bucketName)}/download-url${qs({ objectKey })}`
   );

const headObject = async (
   serverId: string,
   bucketName: string,
   objectKey: string
): Promise<S3ObjectMetadata | null> => {
   try {
      return await api.get<S3ObjectMetadata>(
         `${objectsPath(serverId, bucketName)}/metadata${qs({ objectKey })}`
      );
   } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      throw error;
   }
};

const saveFromUrl = (url: string, fileName: string) => {
   const anchor = document.createElement("a");
   anchor.href = url;
   anchor.download = fileName;
   anchor.rel = "noopener";
   anchor.style.display = "none";
   document.body.appendChild(anchor);
   anchor.click();
   anchor.remove();
};

export { getDownloadUrl, headObject, saveFromUrl };
