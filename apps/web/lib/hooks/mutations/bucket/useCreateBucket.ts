import { api, serverPath, type ApiError } from "@/lib/api";
import useApiMutation from "@/lib/hooks/mutations/useApiMutation";
import { queryKeys } from "@/lib/query-keys";
import type { CreatedBucket } from "@s3-viewer/types";

const useCreateBucket = () =>
   useApiMutation<CreatedBucket, ApiError, string>({
      request: (bucketName, { serverId }) =>
         api.post<CreatedBucket>(`${serverPath(serverId)}/buckets`, {
            bucketName,
         }),
      refreshes: ({ scope }) => [
         queryKeys.buckets(scope.userId, scope.serverId),
      ],
      invalidates: ({ scope }) => [
         queryKeys.members(scope.userId, scope.serverId),
         queryKeys.sentInvites(scope.userId, scope.serverId),
      ],
   });

export default useCreateBucket;
