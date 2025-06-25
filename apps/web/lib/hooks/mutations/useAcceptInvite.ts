import { acceptInvite } from "@/lib/api/server";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useAcceptInvite = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: ({ inviteId }: { inviteId: string }) =>
         acceptInvite(inviteId),

      onSuccess: () => {
         toast.success("Invitation accepted");
         queryClient.invalidateQueries({ queryKey: ["servers"] });
         queryClient.invalidateQueries({ queryKey: ["received-invites"] });
      },

      onError: (error: Error) => {
         toast.error(error.message);
      },
   });
};

export default useAcceptInvite;
