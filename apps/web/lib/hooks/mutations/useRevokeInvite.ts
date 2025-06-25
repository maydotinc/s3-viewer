import { revokeInvite } from "@/lib/api/server";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useRevokeInvite = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: ({ inviteId }: { inviteId: string }) =>
         revokeInvite(inviteId),

      onSuccess: () => {
         toast.success("Invitation revoked");
         queryClient.invalidateQueries({ queryKey: ["sent-invites"] });
      },

      onError: (error: Error) => {
         toast.error(error.message);
      },
   });
};

export default useRevokeInvite;
