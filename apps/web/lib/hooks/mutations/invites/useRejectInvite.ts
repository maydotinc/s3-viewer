import { createApiRequest, handleApiError } from "@/lib/utils/api";
import { inviteIdBodySchema, InviteIdInput } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useRejectInvite = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: async (
         input: InviteIdInput
      ): Promise<{ message: string }> => {
         const data = inviteIdBodySchema.parse(input);
         const response = await createApiRequest("/server/invites/reject", {
            method: "POST",
            body: JSON.stringify(data),
         });

         if (!response.ok) {
            await handleApiError(response);
         }

         const res = await response.json();
         return { message: res.message };
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
