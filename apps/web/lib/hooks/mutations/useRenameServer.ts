import { renameServer } from "@/lib/api/server";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useRenameServer = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: ({
         serverId,
         serverName,
      }: {
         serverId: string;
         serverName: string;
      }) => renameServer(serverId, serverName),

      onSuccess: (data, variables) => {
         toast.success("Server renamed successfully");
         queryClient.invalidateQueries({
            queryKey: ["server", variables.serverId],
         });
      },

      onError: (error: Error) => {
         toast.error(error.message);
      },
   });
};

export default useRenameServer;
