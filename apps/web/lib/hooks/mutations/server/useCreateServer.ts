import { createApiRequest, handleApiError } from "@/lib/utils/api";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useCreateServer = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: async ({
         encryptedCredentials,
         serverName,
         bucketNames,
      }: {
         encryptedCredentials: string;
         serverName: string;
         bucketNames?: string[];
      }): Promise<{ message: string; serverId: string }> => {
         const response = await createApiRequest("/server/manage/create", {
            method: "POST",
            body: JSON.stringify({
               encryptedCredentials,
               serverName,
               bucketNames,
            }),
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
