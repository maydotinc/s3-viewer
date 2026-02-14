import { createApiRequest, handleApiError } from "@/lib/utils/api";
import { createServerSchema, CreateServerInput } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useCreateServer = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: async (
         input: CreateServerInput
      ): Promise<{ message: string; serverId: string }> => {
         const data = createServerSchema.parse(input);
         const response = await createApiRequest("/server/manage/create", {
            method: "POST",
            body: JSON.stringify(data),
         });

         if (!response.ok) {
            await handleApiError(response);
         }

         const res = await response.json();
         return { message: res.message, serverId: res.serverId };
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
