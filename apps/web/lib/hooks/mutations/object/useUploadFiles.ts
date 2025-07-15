import useSessionStore from "@/lib/stores/sessionStore";
import { UploadParams } from "@/lib/stores/uploadStore";
import getPresignedUrl from "@/lib/utils/s3/getPresignedUrl";
import {
   MULTIPART_THRESHOLD,
   uploadFileMultipart,
} from "@/lib/utils/s3/multipartUpload";
import uploadToUrl from "@/lib/utils/s3/uploadToUrl";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation } from "@tanstack/react-query";

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
      }: UploadParams): Promise<{
         message: string;
         filesUploaded: number;
         filesSkipped: number;
         errors: string[];
      }> => {
         const currentServerId = serverId || sessionServerId;
         const uploadPromises: Promise<{
            success: boolean;
            fileName: string;
            filePath: string;
            error?: string;
         }>[] = [];

         for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file) continue;

            const uploadPromise = async () => {
               try {
                  const objectKey = `${prefix}${file.webkitRelativePath || file.name}`;
                  const filePath = file.webkitRelativePath || file.name;

                  if (file.size > MULTIPART_THRESHOLD) {
                     console.log(
                        "Uploading file",
                        file.name,
                        "with multipart upload"
                     );
                     const { upload, cancel } = uploadFileMultipart(
                        file,
                        bucketName,
                        objectKey,
                        currentServerId!,
                        (progress: number) =>
                           onProgress?.(
                              filePath,
                              progress,
                              file.name,
                              file.size
                           )
                     );
                     onCancelReady?.(filePath, cancel, file.size);

                     const result = await upload();
                     if (result.success) {
                        onFileComplete?.(filePath, file.name, file.size);
                        return {
                           success: true,
                           fileName: file.name,
                           filePath,
                        };
                     } else {
                        return {
                           success: false,
                           fileName: file.name,
                           filePath,
                           error: result.error || "Multipart upload failed",
                        };
                     }
                  } else {
                     console.log(
                        "Uploading file",
                        file.name,
                        "with single-part upload"
                     );
                     const { url } = await getPresignedUrl(
                        bucketName,
                        objectKey,
                        file.type,
                        currentServerId!
                     );

                     const { upload, cancel } = uploadToUrl(
                        url,
                        file,
                        (progress: number) =>
                           onProgress?.(
                              filePath,
                              progress,
                              file.name,
                              file.size
                           )
                     );
                     onCancelReady?.(filePath, cancel, file.size);

                     const result = await upload();
                     if (result.success) {
                        onFileComplete?.(filePath, file.name, file.size);
                        return {
                           success: true,
                           fileName: file.name,
                           filePath,
                        };
                     } else {
                        return {
                           success: false,
                           fileName: file.name,
                           filePath,
                           error: result.error || "Upload failed",
                        };
                     }
                  }
               } catch (error) {
                  const filePath = file.webkitRelativePath || file.name;
                  if (
                     error instanceof Error &&
                     error.message === "Upload cancelled"
                  ) {
                     console.log(`Upload cancelled for ${file.name}`);
                     return {
                        success: false,
                        fileName: file.name,
                        filePath,
                        error: "Upload cancelled",
                     };
                  } else {
                     console.error(`Upload failed for ${file.name}:`, error);
                     return {
                        success: false,
                        fileName: file.name,
                        filePath,
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

      onSuccess: (data, variables) => {
         const totalFiles =
            data.filesUploaded + data.filesSkipped + data.errors.length;

         if (data.filesUploaded === totalFiles) {
            if (data.filesUploaded === 1) {
               toast.success("File uploaded successfully");
               return;
            }
            toast.success(
               `All ${data.filesUploaded} files uploaded successfully`
            );
            return;
         }

         if (data.errors.length === totalFiles) {
            toast.error(
               `All uploads failed: ${data.errors.slice(0, 2).join(", ")}${data.errors.length > 2 ? "..." : ""}`
            );
            return;
         }

         if (data.filesSkipped === totalFiles) {
            toast.warning("All uploads were cancelled");
            return;
         }

         if (data.filesUploaded > 0 && data.errors.length > 0) {
            toast.success(`${data.filesUploaded} files uploaded successfully`);
            toast.error(`${data.errors.length} files failed to upload`);
            return;
         }

         if (data.filesUploaded > 0 && data.filesSkipped > 0) {
            toast.success(`${data.filesUploaded} files uploaded successfully`);
            toast.warning(`${data.filesSkipped} files were cancelled`);
            return;
         }

         if (data.errors.length > 0) {
            toast.error(`${data.errors.length} files failed to upload`);
            if (data.filesSkipped > 0) {
               toast.warning(`${data.filesSkipped} files were cancelled`);
            }
            return;
         }

         toast.info("Upload operation completed");
      },
   });
};

export default useUploadFiles;
