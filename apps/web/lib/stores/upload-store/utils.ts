import { toast } from "@s3-viewer/ui/components/toast";

const CONCURRENCY_LIMIT = 3;

interface UploadProgress {
   [filePath: string]: {
      fileName: string;
      progress: number;
      fileSize: number;
      cancelFn?: () => void | Promise<void>;
      status: "pending" | "active" | "completed" | "failed" | "cancelled";
   };
}

interface QueuedFile {
   file: File;
   filePath: string;
   bucketName: string;
   serverId: string;
   prefix: string;
}

const showBatchCompletionToast = (uploadProgress: UploadProgress) => {
   const completed = Object.values(uploadProgress).filter(
      (f) => f.status === "completed"
   ).length;

   if (completed > 0) {
      if (completed === 1) {
         toast.success("File uploaded successfully");
      } else {
         toast.success(`${completed} files uploaded successfully`);
      }
   } else {
      toast.error("No files uploaded");
   }
};

const checkForCompletion = (state: any) => {
   const anyActiveOrPending = Object.values(state.uploadProgress).some(
      (f: any) => f.status === "active" || f.status === "pending"
   );

   if (state.uploadQueue.length === 0 && !anyActiveOrPending) {
      if (state.completionToastShown) return;
      state.completionToastShown = true;
      state.isUploading = false;

      const hasCompletedUploads = Object.values(state.uploadProgress).some(
         (f: any) => f.status === "completed"
      );
      if (hasCompletedUploads) state.onUploadComplete?.();

      showBatchCompletionToast(state.uploadProgress);
   }
};

export { checkForCompletion, CONCURRENCY_LIMIT };
export type { QueuedFile, UploadProgress };
