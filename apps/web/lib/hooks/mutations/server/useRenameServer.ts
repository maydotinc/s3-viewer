import { api, field, serverPath, type ApiError } from "@/lib/api";
import useApiMutation from "@/lib/hooks/mutations/useApiMutation";
import { queryKeys } from "@/lib/query-keys";
import { RenameServerInput, ServerInfo } from "@s3-viewer/types";

const useRenameServer = () =>
   useApiMutation<ServerInfo, ApiError, RenameServerInput>({
      request: ({ serverId, serverName }) =>
         api
            .patch<{ server: ServerInfo }>(serverPath(serverId), { serverName })
            .then(field("server")),
      success: "Server renamed",
      invalidates: ({ scope }) => [queryKeys.servers(scope.userId)],
   });

export default useRenameServer;
