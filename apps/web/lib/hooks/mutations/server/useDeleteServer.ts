import { createApiRequest, handleApiError } from "@/lib/utils/api";
import { serverIdBodySchema, ServerIdInput } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useDeleteServer = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: async (
         input: ServerIdInput
      ): Promise<{ message: string }> => {
         const data = serverIdBodySchema.parse(input);
         const response = await createApiRequest("/server/manage/delete", {
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
         toast.success("Server deleted");
         queryClient.invalidateQueries({ queryKey: ["servers"] });
      },

      onError: (error: Error) => {
         toast.error("Unable to delete server", {
            description: error.message,
         });
      },
   });
};

export default useDeleteServer;
