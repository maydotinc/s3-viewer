import { ApiError, api, serverPath } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useUserId } from "@/lib/stores/sessionStore";
import { toastError } from "@/lib/utils/toast";
import { SendInviteInput, SendInviteResult } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useSendInvite = () => {
   const queryClient = useQueryClient();
   const userId = useUserId();

   return useMutation<SendInviteResult, ApiError, SendInviteInput>({
      mutationFn: async ({ serverId, ...body }) => {
         const { invites, alreadyMembers = [] } = await api.post<
            Partial<SendInviteResult>
         >(`${serverPath(serverId)}/invites`, body);
         return { invites: invites ?? [], alreadyMembers };
      },
      onSuccess: ({ invites, alreadyMembers }, { serverId }) => {
         if (invites.length > 0) {
            toast.success(
               invites.length === 1
                  ? "Invite sent"
                  : `${invites.length} invites sent`
            );
         }
         if (alreadyMembers.length > 0) {
            toast.info(
               alreadyMembers.length === 1
                  ? `${alreadyMembers[0]} is already a member`
                  : `${alreadyMembers.length} of those people are already members`
            );
         }
         queryClient.invalidateQueries({
            queryKey: queryKeys.sentInvites(userId, serverId),
         });
      },
      onError: toastError("Couldn't send invites"),
   });
};

export default useSendInvite;
