import { api, objectsPath, qs } from "@/lib/api";
import type { S3PresignedUrl } from "@s3-viewer/types";

const getDownloadUrl = (
   serverId: string,
   bucketName: string,
   objectKey: string
) =>
   api.get<S3PresignedUrl>(
      `${objectsPath(serverId, bucketName)}/download-url${qs({ objectKey })}`
   );

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

export { getDownloadUrl, saveFromUrl };
