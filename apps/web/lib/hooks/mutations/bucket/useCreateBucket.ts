import { api, field, serverPath, type ApiError } from "@/lib/api";
import useApiMutation from "@/lib/hooks/mutations/useApiMutation";
import { queryKeys } from "@/lib/query-keys";
import type { S3Bucket } from "@s3-viewer/types";

const useCreateBucket = () =>
   useApiMutation<S3Bucket, ApiError, string>({
      request: (bucketName, { serverId }) =>
         api
            .post<{
               bucket: S3Bucket;
            }>(`${serverPath(serverId)}/buckets`, { bucketName })
            .then(field("bucket")),
      refreshes: ({ scope }) => [
         queryKeys.buckets(scope.userId, scope.serverId),
      ],
      invalidates: ({ scope }) => [
         queryKeys.members(scope.userId, scope.serverId),
         queryKeys.sentInvites(scope.userId, scope.serverId),
      ],
   });

export default useCreateBucket;
