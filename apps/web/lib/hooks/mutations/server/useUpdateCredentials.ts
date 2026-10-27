import { api, field, serverPath, type ApiError } from "@/lib/api";
import useApiMutation from "@/lib/hooks/mutations/useApiMutation";
import { queryKeys } from "@/lib/query-keys";
import { ServerInfo, UpdateCredentialsInput } from "@s3-viewer/shared";

const useUpdateCredentials = () =>
   useApiMutation<ServerInfo, ApiError, UpdateCredentialsInput>({
      request: ({ serverId, encryptedCredentials }) =>
         api
            .patch<{
               server: ServerInfo;
            }>(`${serverPath(serverId)}/credentials`, { encryptedCredentials })
            .then(field("server")),
      refreshes: ({ data, scope }) => [
         queryKeys.servers(scope.userId),
         queryKeys.server(scope.userId, data.id),
      ],
      success: "Credentials updated",
   });

export default useUpdateCredentials;
