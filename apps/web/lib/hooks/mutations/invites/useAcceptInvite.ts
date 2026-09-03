import { ApiError, api, invitePath } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useUserId } from "@/lib/stores/sessionStore";
import { toastError } from "@/lib/utils/toast";
import { InviteIdInput, ServerInfo } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useAcceptInvite = () => {
   const queryClient = useQueryClient();
   const userId = useUserId();

   return useMutation<ServerInfo, ApiError, InviteIdInput>({
      mutationFn: async ({ inviteId }) =>
         (
            await api.post<{ server: ServerInfo }>(
               `${invitePath(inviteId)}/accept`
            )
         ).server,
      onSuccess: (server) => {
         toast.success(`Joined ${server.name}`);
         for (const queryKey of [
            queryKeys.receivedInvites(userId),
            queryKeys.servers(userId),
            queryKeys.buckets(userId, server.id),
            queryKeys.members(userId, server.id),
         ]) {
            queryClient.invalidateQueries({ queryKey });
         }
      },
      onError: toastError("Couldn't accept the invite"),
   });
};

export default useAcceptInvite;
