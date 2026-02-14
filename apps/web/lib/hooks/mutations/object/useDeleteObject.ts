import { createApiRequest, handleApiError } from "@/lib/utils/api";
import { deleteMultipleBodySchema, s3BodyBase } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation } from "@tanstack/react-query";

const useDeleteObject = () => {
   return useMutation({
      mutationFn: async ({
         serverId,
         bucketName,
         fileNames,
      }: {
         serverId: string;
         bucketName: string;
         fileNames: string[];
      }): Promise<{ message: string }> => {
         if (fileNames.length === 0) {
            return { message: "No files specified for deletion" };
         }

         if (fileNames.length === 1) {
            const fileName = fileNames[0];
            if (!fileName) {
               return { message: "Invalid file name" };
            }

            const data = s3BodyBase.parse({
               serverId,
               bucketName,
               objectKey: fileName,
            });
            const response = await createApiRequest(`/s3/object/delete`, {
               method: "DELETE",
               body: JSON.stringify(data),
            });

            if (!response.ok) {
               await handleApiError(response);
            }

            const res = await response.json();
            return { message: res.message };
         } else {
            const data = deleteMultipleBodySchema.parse({
               serverId,
               bucketName,
               objectKeys: fileNames,
            });
            const response = await createApiRequest(
               `/s3/object/delete-multiple`,
               {
                  method: "DELETE",
                  body: JSON.stringify(data),
               }
            );

            if (!response.ok) {
               await handleApiError(response);
            }

            const res = await response.json();
            return { message: res.message };
         }
      },

      onSuccess: (_, { fileNames }) => {
         const fileCount = fileNames.length;
         const isMultiple = fileCount > 1;

         toast.success(
            `${isMultiple ? `${fileCount} objects` : "Object"} deleted successfully`
         );
      },

      onError: (error: Error) => {
         toast.error("Unable to delete object(s)", {
            description: error.message,
         });
      },
   });
};

export default useDeleteObject;
