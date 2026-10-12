import { api, bucketPath, type ApiError } from "@/lib/api";
import useApiMutation, {
   invalidateOn,
} from "@/lib/hooks/mutations/useApiMutation";
import { queryKeys } from "@/lib/query-keys";

const useRemoveBucket = () =>
   useApiMutation<void, ApiError, string>({
      request: (bucketName, { serverId }) =>
         api.delete<void>(bucketPath(serverId, bucketName)),
      removes: ({ variables: bucketName, scope }) => [
         queryKeys.bucket(scope.userId, scope.serverId, bucketName),
      ],
      invalidates: ({ scope }) => [
         queryKeys.buckets(scope.userId, scope.serverId),
         ...queryKeys.sentInviteScopes(scope.userId, scope.serverId),
      ],
      failure: invalidateOn(404, ({ scope }) => [
         queryKeys.buckets(scope.userId, scope.serverId),
      ]),
   });

export default useRemoveBucket;
