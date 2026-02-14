import { createApiRequest, handleApiError } from "@/lib/utils/api";
import { establishSchema } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation } from "@tanstack/react-query";

type EstablishResult = {
   message: string;
   bucketCount: number;
   listBucketsAllowed: boolean;
   bucketNames: string[];
};

const useEstablishConnection = () => {
   return useMutation({
      mutationFn: async (
         encryptedCredentials: string
      ): Promise<EstablishResult> => {
         const data = establishSchema.parse({ encryptedCredentials });
         const response = await createApiRequest("/server/manage/establish", {
            method: "POST",
            body: JSON.stringify(data),
         });

         if (!response.ok) {
            await handleApiError(response);
         }

         const res = await response.json();
         return {
            message: res.message,
            bucketCount: res.bucketCount,
            listBucketsAllowed: res.listBucketsAllowed,
            bucketNames: res.bucketNames ?? [],
         };
      },

      onError: (error: Error) => {
         toast.error("Unable to establish connection", {
            description: error.message,
         });
      },
   });
};

export default useEstablishConnection;
