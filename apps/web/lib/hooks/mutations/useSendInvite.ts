import { sendInvite } from "@/lib/api/server";
import { Role } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useSendInvite = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: ({
         serverId,
         emails,
         role,
         expiresAt,
      }: {
         serverId: string;
         emails: string[];
         role: Role;
         expiresAt?: string;
      }) => {
         const expiry =
            expiresAt ||
            new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
         return sendInvite(serverId, emails, role, expiry);
      },

      onSuccess: (data, variables) => {
         toast.success("Invitation sent successfully");
         queryClient.invalidateQueries({
            queryKey: ["server-users", variables.serverId],
         });
      },

      onError: (error: Error) => {
         toast.error(error.message);
      },
   });
};

export default useSendInvite;
