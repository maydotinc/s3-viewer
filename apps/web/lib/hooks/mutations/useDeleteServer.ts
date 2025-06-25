import { deleteServer } from "@/lib/api/server";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useDeleteServer = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: ({ serverId }: { serverId: string }) =>
         deleteServer(serverId),

      onSuccess: (data, variables) => {
         toast.success("Server deleted successfully");
         queryClient.invalidateQueries({ queryKey: ["servers"] });
         queryClient.invalidateQueries({
            queryKey: ["server-users", variables.serverId],
         });
      },

      onError: (error: Error) => {
         toast.error(error.message);
      },
   });
};

export default useDeleteServer;
