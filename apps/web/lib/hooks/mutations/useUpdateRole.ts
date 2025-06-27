import { createApiRequest, handleApiError } from "@/lib/utils/api";
import { Role } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useUpdateRole = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: async (data: {
         userId: string;
         role: Role;
      }): Promise<{ message: string }> => {
         const response = await createApiRequest(`/server/update/role`, {
            method: "PUT",
            body: JSON.stringify(data),
         });

         if (!response.ok) {
            await handleApiError(response);
         }

         const responseData = await response.json();
         return { message: responseData.message };
      },

      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ["server-users"] });
         toast.success("Role updated");
      },

      onError: (error: Error) => {
         toast.error("Unable to update role", {
            description: error.message,
         });
      },
   });
};

export default useUpdateRole;
