import { createApiRequest, handleApiError } from "@/lib/utils/api";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useDisconnectServer = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: async ({
         serverId,
      }: {
         serverId: string;
      }): Promise<{ message: string }> => {
         const response = await createApiRequest("/server/manage/disconnect", {
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
         toast.success("Disconnected from server");
         queryClient.invalidateQueries({ queryKey: ["servers"] });
      },

      onError: (error: Error) => {
         toast.error("Unable to disconnect from server", {
            description: error.message,
         });
      },
   });
};

export default useDisconnectServer;
