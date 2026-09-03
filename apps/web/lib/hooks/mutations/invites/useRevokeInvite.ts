import { ApiError, api, serverInvitePath } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useUserId } from "@/lib/stores/sessionStore";
import { toastError } from "@/lib/utils/toast";
import type { RevokeInviteInput } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useRevokeInvite = () => {
   const queryClient = useQueryClient();
   const userId = useUserId();

   return useMutation<void, ApiError, RevokeInviteInput>({
      mutationFn: ({ serverId, inviteId }) =>
         api.delete<void>(serverInvitePath(serverId, inviteId)),
      onSuccess: (_data, { serverId }) => {
         toast.success("Invite revoked");
         for (const queryKey of [
            queryKeys.sentInvites(userId, serverId),
            queryKeys.sentInvitesAll(userId),
         ]) {
            queryClient.invalidateQueries({ queryKey });
         }
      },
      onError: toastError("Couldn't revoke the invite"),
   });
};

export default useRevokeInvite;
