import { createApiRequest, handleApiError } from "@/lib/utils/api";
import { Role } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useDeleteRole = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: async (data: {
         serverId: string;
         userId: string;
         role: Role;
      }): Promise<{ message: string }> => {
         const response = await createApiRequest(
            `/server/invites/delete-role`,
            {
               method: "DELETE",
               body: JSON.stringify(data),
            }
         );

         if (!response.ok) {
            await handleApiError(response);
         }

         const responseData = await response.json();
         return { message: responseData.message };
      },

      onSuccess: () => {
         toast.success("User removed");
         queryClient.invalidateQueries({ queryKey: ["server-users"] });
      },

      onError: (error: Error) => {
         toast.error("Unable to remove user", {
            description: error.message,
         });
      },
   });
};

export default useDeleteRole;
