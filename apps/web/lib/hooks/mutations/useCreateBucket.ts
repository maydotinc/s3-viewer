import useSessionStore from "@/lib/stores/sessionStore";
import { createApiRequest, handleApiError } from "@/lib/utils/api";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useCreateBucket = (serverId: string) => {
   const queryClient = useQueryClient();
   const sessionServerId = useSessionStore((state) => state.serverId);
   const currentServerId = serverId || sessionServerId;

   return useMutation({
      mutationFn: async (bucketName: string): Promise<{ message: string }> => {
         const response = await createApiRequest("/s3/bucket/create", {
            method: "PUT",
            body: JSON.stringify({ bucketName, serverId: currentServerId }),
         });

         if (!response.ok) {
            await handleApiError(response);
         }

         const data = await response.json();
         return data;
      },

      onSuccess: () => {
         toast.success("Bucket created successfully");
         queryClient.invalidateQueries({
            queryKey: ["buckets", currentServerId],
         });
      },
      onError: (error: Error) => {
         toast.error("Unable to create bucket", {
            description: error.message,
         });
      },
   });
};

export default useCreateBucket;
