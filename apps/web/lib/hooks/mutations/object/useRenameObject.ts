import { createApiRequest, handleApiError } from "@/lib/utils/api";
import { renameObjectBodySchema } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation } from "@tanstack/react-query";

const useRenameObject = () => {
   return useMutation({
      mutationFn: async ({
         serverId,
         bucketName,
         objectKey,
         newObjectKey,
      }: {
         serverId: string;
         bucketName: string;
         objectKey: string;
         newObjectKey: string;
      }): Promise<{ message: string }> => {
         const data = renameObjectBodySchema.parse({
            serverId,
            bucketName,
            objectKey,
            newObjectKey,
         });
         const response = await createApiRequest(`/s3/object/rename`, {
            method: "POST",
            body: JSON.stringify(data),
         });

         if (!response.ok) {
            await handleApiError(response);
         }

         const res = await response.json();
         return { message: res.message };
      },

      onSuccess: () => {
         toast.success("Object renamed successfully");
      },

      onError: (error: Error) => {
         toast.error("Unable to rename object", {
            description: error.message,
         });
      },
   });
};

export default useRenameObject;
