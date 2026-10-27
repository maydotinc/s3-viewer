import { objectsPath } from "@/lib/api";
import { existingKeys } from "@/lib/utils/s3/key-exists";
import type { S3ObjectsExist } from "@s3-viewer/shared";

type UploadPreflight = {
   serverId: string;
   bucketName: string;
   keys: string[];
   signal: AbortSignal;
};

const checkUploadConflicts = ({
   serverId,
   bucketName,
   keys,
   signal,
}: UploadPreflight): Promise<S3ObjectsExist> =>
   existingKeys({
      path: objectsPath(serverId, bucketName),
      keys,
      signal,
      requireETags: true,
   });

export { checkUploadConflicts };
