import { createApiRequest, handleApiError } from "@/lib/utils/api";
import { inviteIdBodySchema, InviteIdInput } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useRevokeInvite = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: async (
         input: InviteIdInput
      ): Promise<{ message: string }> => {
         const data = inviteIdBodySchema.parse(input);
         const response = await createApiRequest("/server/invites/revoke", {
            method: "DELETE",
            body: JSON.stringify(data),
         });

         if (!response.ok) {
            await handleApiError(response);
         }

         const res = await response.json();
         return { message: res.message };
      },

      onSuccess: () => {
         toast.success("Invitation revoked successfully");
         queryClient.invalidateQueries({ queryKey: ["sent-invites"] });
      },

      onError: (error: Error) => {
         toast.error("Unable to revoke invite", {
            description: error.message,
         });
      },
   });
};

export default useRevokeInvite;
