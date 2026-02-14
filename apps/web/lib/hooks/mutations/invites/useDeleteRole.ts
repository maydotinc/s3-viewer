import { createApiRequest, handleApiError } from "@/lib/utils/api";
import { deleteRoleSchema, DeleteRoleInput } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useDeleteRole = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: async (
         input: DeleteRoleInput
      ): Promise<{ message: string }> => {
         const data = deleteRoleSchema.parse(input);
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

         const res = await response.json();
         return { message: res.message };
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
