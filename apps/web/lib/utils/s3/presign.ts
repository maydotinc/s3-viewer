import { api, objectsPath, qs } from "@/lib/api";
import {
   PRESIGN_EXPIRY_SECONDS,
   SECOND_MS,
   type S3PresignedUrl,
} from "@s3-viewer/shared";

const PRESIGN_EXPIRY_MS = PRESIGN_EXPIRY_SECONDS * SECOND_MS;
const PRESIGN_STALE_MS = 0.8 * PRESIGN_EXPIRY_MS;

const getDownloadUrl = (
   serverId: string,
   bucketName: string,
   objectKey: string
) =>
   api.get<S3PresignedUrl>(
      `${objectsPath(serverId, bucketName, "/download-url")}${qs({ objectKey })}`
   );

export { PRESIGN_STALE_MS, getDownloadUrl };
