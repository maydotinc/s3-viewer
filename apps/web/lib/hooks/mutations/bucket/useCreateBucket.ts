import useSessionStore from "@/lib/stores/sessionStore";
import { createApiRequest, handleApiError } from "@/lib/utils/api";
import { bucketBodySchema } from "@s3-viewer/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useCreateBucket = (serverId: string) => {
   const queryClient = useQueryClient();
   const sessionServerId = useSessionStore((state) => state.serverId);
   const currentServerId = serverId || sessionServerId;

   return useMutation({
      mutationFn: async (bucketName: string): Promise<{ message: string }> => {
         const data = bucketBodySchema.parse({
            bucketName,
            serverId: currentServerId,
         });
         const response = await createApiRequest("/s3/bucket/create", {
            method: "PUT",
            body: JSON.stringify(data),
         });

         if (!response.ok) {
            await handleApiError(response);
         }

         return await response.json();
      },

      onSuccess: () => {
         queryClient.invalidateQueries({
            queryKey: ["buckets", currentServerId],
         });
      },
   });
};

export default useCreateBucket;
