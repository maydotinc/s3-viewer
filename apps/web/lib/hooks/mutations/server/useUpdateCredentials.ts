import { ApiError, api, serverPath } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useUserId } from "@/lib/stores/sessionStore";
import { ServerInfo, UpdateCredentialsInput } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useUpdateCredentials = () => {
   const queryClient = useQueryClient();
   const userId = useUserId();

   return useMutation<ServerInfo, ApiError, UpdateCredentialsInput>({
      mutationFn: async ({ serverId, encryptedCredentials }) =>
         (
            await api.patch<{ server: ServerInfo }>(
               `${serverPath(serverId)}/credentials`,
               { encryptedCredentials }
            )
         ).server,
      onSuccess: async (server) => {
         toast.success("Credentials updated");
         await Promise.all([
            queryClient.invalidateQueries({
               queryKey: queryKeys.servers(userId),
            }),
            queryClient.invalidateQueries({
               queryKey: queryKeys.server(userId, server.id),
            }),
         ]);
      },
   });
};

export default useUpdateCredentials;
