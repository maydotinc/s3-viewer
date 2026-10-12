import { api, serverPath, type ApiError } from "@/lib/api";
import useApiMutation from "@/lib/hooks/mutations/useApiMutation";
import { queryKeys } from "@/lib/query-keys";
import { ServerScope } from "@s3-viewer/types";

const useDeleteServer = () =>
   useApiMutation<void, ApiError, ServerScope>({
      request: ({ serverId }) => api.delete<void>(serverPath(serverId)),
      removes: ({ variables: { serverId }, scope }) => [
         queryKeys.server(scope.userId, serverId),
      ],
      success: "Server deleted",
      invalidates: ({ scope }) => [queryKeys.servers(scope.userId)],
   });

export default useDeleteServer;
