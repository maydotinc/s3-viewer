import useSessionStore from "@/lib/stores/sessionStore";
import getPresignedUrl from "@/lib/utils/s3/getPresignedUrl";
import uploadToUrl from "@/lib/utils/s3/uploadToUrl";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation } from "@tanstack/react-query";

interface UploadFilesParams {
   files: File[];
   bucketName: string;
   serverId?: string;
   prefix?: string;
   onProgress?: (
      fileIndex: number,
      progress: number,
      fileName: string,
      fileSize: number
   ) => void;
   onFileComplete?: (
      fileIndex: number,
      fileName: string,
      fileSize: number
   ) => void;
   onCancelReady?: (
      fileIndex: number,
      cancelFn: () => void,
      fileSize: number
   ) => void;
}

const useUploadFiles = () => {
   const sessionServerId = useSessionStore((state) => state.serverId);

   return useMutation({
      mutationFn: async ({
         files,
         bucketName,
         serverId,
         prefix = "",
         onProgress,
         onFileComplete,
         onCancelReady,
      }: UploadFilesParams): Promise<{
         message: string;
         filesUploaded: number;
         filesSkipped: number;
         errors: string[];
      }> => {
         const currentServerId = serverId || sessionServerId;
         const uploadPromises: Promise<{
            success: boolean;
            fileName: string;
            fileIndex: number;
            error?: string;
         }>[] = [];

         for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file) continue;

            const uploadPromise = async () => {
               try {
                  const objectKey = `${prefix}${file.name}`;

                  const { url } = await getPresignedUrl(
                     bucketName,
                     objectKey,
                     file.type,
                     currentServerId
                  );

                  const { promise, cancel } = uploadToUrl(
                     url,
                     file,
                     (progress: number) =>
                        onProgress?.(i, progress, file.name, file.size)
                  );
                  onCancelReady?.(i, cancel, file.size);

                  await promise;
                  onFileComplete?.(i, file.name, file.size);

                  return {
                     success: true,
                     fileName: file.name,
                     fileIndex: i,
                  };
               } catch (error) {
                  if (
                     error instanceof Error &&
                     error.message === "Upload cancelled"
                  ) {
                     console.log(`Upload cancelled for ${file.name}`);
                     return {
                        success: false,
                        fileName: file.name,
                        fileIndex: i,
                        error: "Upload cancelled",
                     };
                  } else {
                     console.error(`Upload failed for ${file.name}:`, error);
                     return {
                        success: false,
                        fileName: file.name,
                        fileIndex: i,
                        error:
                           error instanceof Error
                              ? error.message
                              : "Upload failed",
                     };
                  }
               }
            };

            uploadPromises.push(uploadPromise());
         }

         const results = await Promise.allSettled(uploadPromises);

         let filesUploaded = 0;
         let filesSkipped = 0;
         const errors: string[] = [];

         results.forEach((result, index) => {
            if (result.status === "fulfilled") {
               const uploadResult = result.value;
               if (uploadResult.success) {
                  filesUploaded++;
               } else {
                  if (uploadResult.error === "Upload cancelled") {
                     filesSkipped++;
                  } else {
                     errors.push(
                        `${uploadResult.fileName}: ${uploadResult.error}`
                     );
                  }
               }
            } else {
               errors.push(`Upload promise rejected: ${result.reason}`);
            }
         });

         let message = "";
         if (filesUploaded === files.length) {
            message = "All files uploaded successfully";
         } else if (filesUploaded > 0) {
            message = `${filesUploaded} of ${files.length} files uploaded successfully`;
         } else {
            message = "No files were uploaded";
         }

         return {
            message,
            filesUploaded,
            filesSkipped,
            errors,
         };
      },

      onSuccess: (data) => {
         if (data.filesUploaded > 1) {
            toast.success(`${data.filesUploaded} files uploaded successfully`);
         } else if (data.filesUploaded === 1) {
            toast.success("File uploaded successfully");
         }

         if (data.errors.length > 0) {
            if (data.filesUploaded === 0) {
               toast.error(
                  `Upload failed: ${data.errors.slice(0, 2).join(", ")}${data.errors.length > 2 ? "..." : ""}`
               );
            } else {
               toast.error(
                  `Some uploads failed: ${data.errors.slice(0, 2).join(", ")}${data.errors.length > 2 ? "..." : ""}`
               );
            }
         }
      },

      onError: (error: Error) => {
         toast.error(error.message);
      },
   });
};

export default useUploadFiles;
