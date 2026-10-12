import { api, serverPath, type ApiError } from "@/lib/api";
import useApiMutation from "@/lib/hooks/mutations/useApiMutation";
import { queryKeys } from "@/lib/query-keys";
import { ServerScope } from "@s3-viewer/types";

const useLeaveServer = () =>
   useApiMutation<void, ApiError, ServerScope>({
      request: ({ serverId }) =>
         api.post<void>(`${serverPath(serverId)}/leave`),
      removes: ({ variables: { serverId }, scope }) => [
         queryKeys.server(scope.userId, serverId),
      ],
      success: "Left server",
      invalidates: ({ scope }) => [queryKeys.servers(scope.userId)],
   });

export default useLeaveServer;
