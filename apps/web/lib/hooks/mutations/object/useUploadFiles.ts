import useSessionStore from "@/lib/stores/sessionStore";
import getPresignedUrl from "@/lib/utils/s3/getPresignedUrl";
import uploadToUrl from "@/lib/utils/s3/uploadToUrl";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface UploadFilesParams {
   files: File[];
   bucketName: string;
   serverId?: string;
   prefix?: string;
   onProgress?: (fileIndex: number, progress: number, fileName: string) => void;
   onFileComplete?: (fileIndex: number, fileName: string) => void;
}

const useUploadFiles = () => {
   const queryClient = useQueryClient();
   const sessionServerId = useSessionStore((state) => state.serverId);

   return useMutation({
      mutationFn: async ({
         files,
         bucketName,
         serverId,
         prefix = "",
         onProgress,
         onFileComplete,
      }: UploadFilesParams): Promise<{
         message: string;
         filesUploaded: number;
      }> => {
         const currentServerId = serverId || sessionServerId;

         for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file) continue;

            const objectKey = `${prefix}${file.name}`;

            const { url } = await getPresignedUrl(
               bucketName,
               objectKey,
               file.type,
               currentServerId
            );

            await uploadToUrl(url, file, (progress: number) =>
               onProgress?.(i, progress, file.name)
            );

            onFileComplete?.(i, file.name);
         }

         return {
            message: "Files uploaded successfully",
            filesUploaded: files.length,
         };
      },

      onSuccess: (data) => {
         if (data.filesUploaded > 1) {
            toast.success(`${data.filesUploaded} files uploaded successfully`);
         } else {
            toast.success("File uploaded successfully");
         }
      },

      onError: (error: Error) => {
         toast.error("Upload failed", {
            description: error.message,
         });
      },
   });
};

export default useUploadFiles;
