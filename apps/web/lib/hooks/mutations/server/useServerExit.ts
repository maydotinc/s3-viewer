import { api, serverPath, type ApiError } from "@/lib/api";
import useApiMutation from "@/lib/hooks/mutations/useApiMutation";
import { queryKeys } from "@/lib/query-keys";
import { ServerScope } from "@s3-viewer/types";

const EXITS = {
   delete: {
      request: ({ serverId }: ServerScope) =>
         api.delete<void>(serverPath(serverId)),
      success: "Server deleted",
   },
   leave: {
      request: ({ serverId }: ServerScope) =>
         api.post<void>(`${serverPath(serverId)}/leave`),
      success: "Left server",
   },
};

// deleting and leaving differ only in the request; either way the server leaves this account's cache
const useServerExit = (kind: keyof typeof EXITS) =>
   useApiMutation<void, ApiError, ServerScope>({
      ...EXITS[kind],
      removes: ({ variables: { serverId }, scope }) => [
         queryKeys.server(scope.userId, serverId),
      ],
      invalidates: ({ scope }) => [queryKeys.servers(scope.userId)],
   });

export default useServerExit;
