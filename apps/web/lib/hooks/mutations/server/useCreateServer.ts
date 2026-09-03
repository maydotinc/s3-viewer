import { ApiError, api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import useSessionStore, { useUserId } from "@/lib/stores/sessionStore";
import { CreateServerInput, ServerInfo } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useCreateServer = () => {
   const queryClient = useQueryClient();
   const userId = useUserId();
   const setServerId = useSessionStore((state) => state.setServerId);

   return useMutation<ServerInfo, ApiError, CreateServerInput>({
      mutationFn: async (body) =>
         (await api.post<{ server: ServerInfo }>("/servers", body)).server,
      onSuccess: async (server) => {
         await queryClient.invalidateQueries({
            queryKey: queryKeys.servers(userId),
         });
         setServerId(server.id);
         toast.success("Server connected");
      },
   });
};

export default useCreateServer;
