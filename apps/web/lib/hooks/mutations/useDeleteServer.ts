import { createApiRequest, handleApiError } from "@/lib/utils/api";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useDeleteServer = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: async ({
         serverId,
      }: {
         serverId: string;
      }): Promise<{ message: string }> => {
         const response = await createApiRequest("/manage/delete", {
            method: "DELETE",
            body: JSON.stringify({ serverId }),
         });

         if (!response.ok) {
            await handleApiError(response);
         }

         const data = await response.json();
         return { message: data.message };
      },

      onSuccess: () => {
         toast.success("Server deleted successfully");
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
