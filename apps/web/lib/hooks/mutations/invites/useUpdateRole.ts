import { createApiRequest, handleApiError } from "@/lib/utils/api";
import { updateRoleSchema, UpdateRoleInput } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useUpdateRole = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: async (
         input: UpdateRoleInput
      ): Promise<{ message: string }> => {
         const data = updateRoleSchema.parse(input);
         const response = await createApiRequest(
            `/server/invites/update-role`,
            {
               method: "PUT",
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
         toast.success("Role updated");
         queryClient.invalidateQueries({ queryKey: ["server-users"] });
      },

      onError: (error: Error) => {
         toast.error("Unable to update role", {
            description: error.message,
         });
      },
   });
};

export default useUpdateRole;
