import { createApiRequest, handleApiError } from "@/lib/utils/api";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation } from "@tanstack/react-query";

const useEstablishConnection = () => {
   return useMutation({
      mutationFn: async (
         encryptedCredentials: string
      ): Promise<{ message: string; bucketCount: number }> => {
         const response = await createApiRequest("/server/manage/establish", {
            method: "POST",
            body: JSON.stringify({ encryptedCredentials }),
         });

         if (!response.ok) {
            await handleApiError(response);
         }

         const data = await response.json();
         return { message: data.message, bucketCount: data.bucketCount };
      },

      onError: (error: Error) => {
         toast.error("Unable to establish connection", {
            description: error.message,
         });
      },
   });
};

export default useEstablishConnection;
