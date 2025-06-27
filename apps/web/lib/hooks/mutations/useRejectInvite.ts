import { createApiRequest, handleApiError } from "@/lib/utils/api";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useRejectInvite = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: async ({ inviteId }: { inviteId: string }) => {
         const response = await createApiRequest("/server/invites/reject", {
            method: "POST",
            body: JSON.stringify({ inviteId }),
         });

         if (!response.ok) {
            await handleApiError(response);
         }

         const data = await response.json();
         return { message: data.message };
      },

      onSuccess: () => {
         toast.success("Invitation rejected successfully");
         queryClient.invalidateQueries({ queryKey: ["received-invites"] });
      },

      onError: (error: Error) => {
         toast.error(error.message);
      },
   });
};

export default useRejectInvite;
