import { api, apiUrl, objectMutationPath } from "@/lib/api";
import type { S3ArchiveTicket } from "@s3-viewer/types";

const archivePath = (serverId: string, bucketName: string): string =>
   objectMutationPath(serverId, bucketName, "/archive");

const requestArchive = (
   serverId: string,
   bucketName: string,
   userId: string,
   objectKeys: readonly string[]
): Promise<S3ArchiveTicket> =>
   api.post<S3ArchiveTicket>(archivePath(serverId, bucketName), {
      expectedUserId: userId,
      objectKeys: [...objectKeys],
   });

const archiveUrl = (
   serverId: string,
   bucketName: string,
   token: string
): string =>
   apiUrl(`${archivePath(serverId, bucketName)}/${encodeURIComponent(token)}`);

export { archiveUrl, requestArchive };
