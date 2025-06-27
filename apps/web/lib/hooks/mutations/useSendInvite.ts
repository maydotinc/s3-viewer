import { createApiRequest, handleApiError } from "@/lib/utils/api";
import { Role } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useSendInvite = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: async ({
         serverId,
         emails,
         role,
         expiresAt,
      }: {
         serverId: string;
         emails: string[];
         role: Role;
         expiresAt?: string;
      }): Promise<{ message: string }> => {
         const expiry =
            expiresAt ||
            new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();

         const response = await createApiRequest("/server/invites/send", {
            method: "POST",
            body: JSON.stringify({ serverId, emails, role, expiresAt: expiry }),
         });

         if (!response.ok) {
            await handleApiError(response);
         }

         const data = await response.json();
         return { message: data.message };
      },

      onSuccess: () => {
         toast.success("Invitation sent successfully");
         queryClient.invalidateQueries({ queryKey: ["sent-invites"] });
      },

      onError: (error: Error) => {
         toast.error("Unable to send invitation", {
            description: error.message,
         });
      },
   });
};

export default useSendInvite;
