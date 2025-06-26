import { createApiRequest, handleApiError } from "@/lib/utils/api";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useRenameServer = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: async ({
         serverId,
         serverName,
      }: {
         serverId: string;
         serverName: string;
      }): Promise<{ message: string }> => {
         const response = await createApiRequest("/manage/rename", {
            method: "PUT",
            body: JSON.stringify({ serverId, serverName }),
         });

         if (!response.ok) {
            await handleApiError(response);
         }

         const data = await response.json();
         return { message: data.message };
      },

      onSuccess: (_, variables) => {
         toast.success("Server renamed successfully");
         queryClient.invalidateQueries({
            queryKey: ["servers"],
         });
      },

      onError: (error: Error) => {
         toast.error("Unable to rename server", {
            description: error.message,
         });
      },
   });
};

export default useRenameServer;
