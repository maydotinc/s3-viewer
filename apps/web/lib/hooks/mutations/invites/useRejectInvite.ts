import { ApiError, api, invitePath } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useUserId } from "@/lib/stores/sessionStore";
import { toastError } from "@/lib/utils/toast";
import { InviteIdInput } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useRejectInvite = () => {
   const queryClient = useQueryClient();
   const userId = useUserId();

   return useMutation<void, ApiError, InviteIdInput>({
      mutationFn: ({ inviteId }) =>
         api.post<void>(`${invitePath(inviteId)}/reject`),
      onSuccess: () => {
         toast.success("Invite declined");
         queryClient.invalidateQueries({
            queryKey: queryKeys.receivedInvites(userId),
         });
      },
      onError: toastError("Couldn't decline the invite"),
   });
};

export default useRejectInvite;
