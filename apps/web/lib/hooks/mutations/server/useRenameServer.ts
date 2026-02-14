import { createApiRequest, handleApiError } from "@/lib/utils/api";
import { renameServerSchema, RenameServerInput } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useRenameServer = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: async (
         input: RenameServerInput
      ): Promise<{ message: string }> => {
         const data = renameServerSchema.parse(input);
         const response = await createApiRequest("/server/manage/rename", {
            method: "PUT",
            body: JSON.stringify(data),
         });

         if (!response.ok) {
            await handleApiError(response);
         }

         const res = await response.json();
         return { message: res.message };
      },

      onSuccess: () => {
         toast.success("Server renamed successfully");
         queryClient.invalidateQueries({ queryKey: ["servers"] });
      },

      onError: (error: Error) => {
         toast.error("Unable to rename server", {
            description: error.message,
         });
      },
   });
};

export default useRenameServer;
