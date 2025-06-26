import { createApiRequest, handleApiError } from "@/lib/utils/api";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useAcceptInvite = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: async ({
         inviteId,
      }: {
         inviteId: string;
      }): Promise<{ message: string }> => {
         const response = await createApiRequest("/manage/invites/accept", {
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
         toast.success("Invitation accepted successfully");
         queryClient.invalidateQueries({ queryKey: ["received-invites"] });
         queryClient.invalidateQueries({ queryKey: ["servers"] });
      },

      onError: (error: Error) => {
         toast.error("Unable to accept invitation", {
            description: error.message,
         });
      },
   });
};

export default useAcceptInvite;
