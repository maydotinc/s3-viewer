import { ApiError, api, serverPath } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useUserId } from "@/lib/stores/sessionStore";
import { RenameServerInput, ServerInfo } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useRenameServer = () => {
   const queryClient = useQueryClient();
   const userId = useUserId();

   return useMutation<ServerInfo, ApiError, RenameServerInput>({
      mutationFn: async ({ serverId, serverName }) =>
         (
            await api.patch<{ server: ServerInfo }>(serverPath(serverId), {
               serverName,
            })
         ).server,
      onSuccess: () => {
         toast.success("Server renamed");
         queryClient.invalidateQueries({
            queryKey: queryKeys.servers(userId),
         });
      },
   });
};

export default useRenameServer;
