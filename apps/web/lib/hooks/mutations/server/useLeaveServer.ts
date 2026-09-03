import { ApiError, api, serverPath } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useUserId } from "@/lib/stores/sessionStore";
import { ServerScope } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useLeaveServer = () => {
   const queryClient = useQueryClient();
   const userId = useUserId();

   return useMutation<void, ApiError, ServerScope>({
      mutationFn: ({ serverId }) =>
         api.post<void>(`${serverPath(serverId)}/leave`),
      onSuccess: (_data, { serverId }) => {
         queryClient.removeQueries({
            queryKey: queryKeys.server(userId, serverId),
         });
         toast.success("Left server");
         queryClient.invalidateQueries({
            queryKey: queryKeys.servers(userId),
         });
      },
   });
};

export default useLeaveServer;
