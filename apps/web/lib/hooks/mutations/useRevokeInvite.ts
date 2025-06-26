import { createApiRequest, handleApiError } from "@/lib/utils/api";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useRevokeInvite = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: async ({
         inviteId,
      }: {
         inviteId: string;
      }): Promise<{ message: string }> => {
         const response = await createApiRequest("/manage/invites/revoke", {
            method: "DELETE",
            body: JSON.stringify({ inviteId }),
         });

         if (!response.ok) {
            await handleApiError(response);
         }

         const data = await response.json();
         return { message: data.message };
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
