import { createApiRequest, handleApiError } from "@/lib/utils/api";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation } from "@tanstack/react-query";
import { GridApi } from "ag-grid-community";

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
         gridApi: GridApi;
      }): Promise<{ message: string }> => {
         if (fileNames.length === 0) {
            console.error("No files specified for deletion");
            return { message: "No files specified for deletion" };
         }

         if (fileNames.length === 1) {
            const fileName = fileNames[0];
            if (!fileName) {
               console.error("Invalid file name");
               return { message: "Invalid file name" };
            }

            const response = await createApiRequest(`/s3/object/delete`, {
               method: "DELETE",
               body: JSON.stringify({
                  serverId,
                  bucketName,
                  objectKey: fileName,
               }),
            });

            if (!response.ok) {
               await handleApiError(response);
            }

            const data = await response.json();
            return { message: data.message };
         } else {
            const response = await createApiRequest(
               `/s3/object/delete-multiple`,
               {
                  method: "DELETE",
                  body: JSON.stringify({
                     serverId,
                     bucketName,
                     objectKeys: fileNames,
                  }),
               }
            );

            if (!response.ok) {
               await handleApiError(response);
            }

            const data = await response.json();
            return { message: data.message };
         }
      },

      onSuccess: (_, { gridApi, fileNames }) => {
         const fileCount = fileNames.length;
         const isMultiple = fileCount > 1;

         toast.success(
            `${isMultiple ? `${fileCount} objects` : "Object"} deleted successfully`
         );

         gridApi.purgeInfiniteCache();
         gridApi.deselectAll();
      },

      onError: (error: Error) => {
         toast.error("Unable to delete object(s)", {
            description: error.message,
         });
      },
   });
};

export default useDeleteObject;
