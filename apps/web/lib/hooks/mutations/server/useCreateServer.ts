import { createApiRequest, handleApiError } from "@/lib/utils/api";
import { ServerCredentials } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useCreateServer = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: async ({
         serverCredentials,
         serverName,
      }: {
         serverCredentials: ServerCredentials;
         serverName: string;
      }): Promise<{ message: string; serverId: string }> => {
         const response = await createApiRequest("/server/manage/create", {
            method: "POST",
            body: JSON.stringify({ serverCredentials, serverName }),
         });

         if (!response.ok) {
            await handleApiError(response);
         }

         const data = await response.json();
         return { message: data.message, serverId: data.serverId };
      },

      onSuccess: () => {
         toast.success("Server connected successfully");
         queryClient.invalidateQueries({ queryKey: ["servers"] });
      },

      onError: (error: Error) => {
         toast.error("Unable to connect server", {
            description: error.message,
         });
      },
   });
};

export default useCreateServer;
