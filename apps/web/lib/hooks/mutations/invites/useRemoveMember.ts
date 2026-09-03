import { ApiError, api, memberPath } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useUserId } from "@/lib/stores/sessionStore";
import { toastError } from "@/lib/utils/toast";
import { RemoveMemberInput } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useRemoveMember = () => {
   const queryClient = useQueryClient();
   const userId = useUserId();

   return useMutation<void, ApiError, RemoveMemberInput>({
      mutationFn: ({ serverId, userId: memberId }) =>
         api.delete<void>(memberPath(serverId, memberId)),
      onSuccess: (_data, { serverId }) => {
         toast.success("Member removed");
         queryClient.invalidateQueries({
            queryKey: queryKeys.members(userId, serverId),
         });
      },
      onError: toastError("Couldn't remove the member"),
   });
};

export default useRemoveMember;
