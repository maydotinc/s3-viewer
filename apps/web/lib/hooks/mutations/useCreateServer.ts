import { createServer } from "@/lib/api/server";
import { ServerCredentials } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useCreateServer = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: ({
         serverCredentials,
         serverName,
      }: {
         serverCredentials: ServerCredentials;
         serverName: string;
      }) => createServer(serverCredentials, serverName),

      onSuccess: () => {
         toast.success("Server connected successfully");
         queryClient.invalidateQueries({ queryKey: ["servers"] });
      },

      onError: (error: Error) => {
         toast.error(error.message);
      },
   });
};

export default useCreateServer;
