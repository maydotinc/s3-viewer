import getPresignedUploadUrl from "@/lib/utils/s3/getPresignedUploadUrl";
import {
   MULTIPART_THRESHOLD,
   uploadFileMultipart,
} from "@/lib/utils/s3/multipartUpload";
import uploadToUrl from "@/lib/utils/s3/uploadToUrl";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import {
   checkForCompletion,
   CONCURRENCY_LIMIT,
   QueuedFile,
   UploadProgress,
} from "./utils";

type UploadStoreState = {
   isUploading: boolean;
   uploadProgress: UploadProgress;
   uploadQueue: QueuedFile[];
   onUploadComplete?: () => void;
   completionToastShown: boolean;
};

type UploadStoreActions = {
   setOnUploadComplete: (callback: () => void) => void;
   startUpload: (params: {
      files: File[];
      bucketName: string;
      serverId: string;
      prefix: string;
   }) => void;
   processQueue: () => void;
   uploadOneFile: (queuedFile: QueuedFile) => void;
   setProgress: (
      filePath: string,
      progress: number,
      fileName: string,
      fileSize: number
   ) => void;
   setCancelFunction: (
      filePath: string,
      cancelFn: () => void | Promise<void>,
      fileSize: number
   ) => void;
   cancelUpload: (filePath: string) => void;
   cancelAllUploads: () => void;
   reset: () => void;
};

type UploadStore = UploadStoreState & UploadStoreActions;

const useUploadStore = create<UploadStore>()(
   immer((set, get) => ({
      isUploading: false,
      uploadProgress: {},
      uploadQueue: [],
      onUploadComplete: undefined,
      completionToastShown: false,

      setOnUploadComplete: (callback) => {
         set((state) => {
            state.onUploadComplete = callback;
         });
      },

      uploadOneFile: async (queuedFile: QueuedFile) => {
         const { file, filePath, bucketName, serverId, prefix } = queuedFile;
         let response: { success: boolean; error?: string };
         try {
            if (file.size > MULTIPART_THRESHOLD) {
               const { upload, cancel } = uploadFileMultipart(
                  file,
                  bucketName,
                  `${prefix}${filePath}`,
                  serverId,
                  (prog: number) =>
                     get().setProgress(filePath, prog, file.name, file.size)
               );
               get().setCancelFunction(filePath, cancel, file.size);

               response = await upload();
            } else {
               const { url } = await getPresignedUploadUrl(
                  bucketName,
                  `${prefix}${filePath}`,
                  file.type,
                  serverId
               );
               const { upload, cancel } = uploadToUrl(
                  url,
                  file,
                  (prog: number) =>
                     get().setProgress(filePath, prog, file.name, file.size)
               );
               get().setCancelFunction(filePath, cancel, file.size);

               response = await upload();
            }

            set((state) => {
               const entry = state.uploadProgress[filePath];
               if (!entry) return;

               if (!response.success) {
                  if (entry.status !== "cancelled") {
                     entry.status = "failed";
                     entry.progress = 0;
                  }
                  return;
               }

               entry.progress = 100;
               entry.status = "completed";
            });
         } catch (err) {
            console.error("Upload failed", err);
         } finally {
            get().processQueue();
         }
      },

      startUpload: (params) => {
         const { files, bucketName, serverId, prefix } = params;

         set((state) => {
            state.isUploading = true;
            state.completionToastShown = false;

            files.forEach((file) => {
               const filePath = file.webkitRelativePath || file.name;

               state.uploadQueue.push({
                  file,
                  filePath,
                  bucketName,
                  serverId,
                  prefix,
               });

               state.uploadProgress[filePath] = {
                  fileName: file.name,
                  progress: 0,
                  fileSize: file.size,
                  status: "pending",
               };
            });

            console.log(`All files added to queue: ${files.length}`);
         });

         get().processQueue();
      },

      processQueue: () => {
         const { uploadQueue, uploadProgress } = get();

         if (uploadQueue.length === 0) {
            console.log("Queue is empty, stopping processing");
            console.log(uploadProgress);
            set((state) => {
               checkForCompletion(state);
            });
            return;
         }
         const activeCount = Object.values(uploadProgress).filter(
            (f) => f.status === "active"
         ).length;
         const availableSlots = CONCURRENCY_LIMIT - activeCount;
         if (availableSlots <= 0) {
            console.log("No available slots, waiting for uploads to complete");
            return;
         }

         const filesToProcess = uploadQueue.slice(0, availableSlots);
         console.log("Processing queue", filesToProcess);

         filesToProcess.forEach((queuedFile) => {
            const { file, filePath, bucketName, serverId, prefix } = queuedFile;

            set((state) => {
               state.uploadQueue = state.uploadQueue.filter(
                  (f) => f.filePath !== filePath
               );
               if (state.uploadProgress[filePath]) {
                  state.uploadProgress[filePath].status = "active";
               }
            });

            get().uploadOneFile(queuedFile);
         });

         set((state) => {
            checkForCompletion(state);
         });
      },

      setProgress: (filePath, progress, fileName, fileSize) => {
         set((state) => {
            if (!state.uploadProgress[filePath]) {
               state.uploadProgress[filePath] = {
                  fileName,
                  progress,
                  fileSize,
                  status: "active",
               };
            } else {
               state.uploadProgress[filePath].fileName = fileName;
               state.uploadProgress[filePath].progress = progress;
               state.uploadProgress[filePath].fileSize = fileSize;
               state.uploadProgress[filePath].status = "active";
            }
         });
      },

      setCancelFunction: (filePath, cancelFn, fileSize) => {
         set((state) => {
            if (!state.uploadProgress[filePath]) {
               state.uploadProgress[filePath] = {
                  fileName: "",
                  progress: 0,
                  fileSize,
                  status: "active",
                  cancelFn,
               };
            } else {
               state.uploadProgress[filePath].cancelFn = cancelFn;
            }
         });
      },

      cancelUpload: (filePath) => {
         const { uploadProgress, uploadQueue } = get();
         const fileUpload = uploadProgress[filePath];

         if (fileUpload?.cancelFn && fileUpload.status !== "completed") {
            const result = fileUpload.cancelFn();

            if (result instanceof Promise) {
               result.catch((error) => {
                  console.error(
                     `Error cancelling upload for file ${filePath}:`,
                     error
                  );
               });
            }
         }

         set((state) => {
            state.uploadQueue = state.uploadQueue.filter(
               (queuedFile) => queuedFile.filePath !== filePath
            );

            if (state.uploadProgress[filePath]) {
               state.uploadProgress[filePath].status = "cancelled";
               state.uploadProgress[filePath].progress = 0;
            }
         });

         get().processQueue();
      },

      cancelAllUploads: () => {
         const { uploadProgress } = get();

         Object.entries(uploadProgress).forEach(([filePath, fileUpload]) => {
            if (fileUpload.cancelFn && fileUpload.status !== "completed") {
               const result = fileUpload.cancelFn();

               if (result instanceof Promise) {
                  result.catch((error) => {
                     console.error(
                        `Error cancelling upload for file ${filePath}:`,
                        error
                     );
                  });
               }
            }
         });

         set((state) => {
            state.isUploading = false;
            state.uploadQueue = [];

            Object.entries(state.uploadProgress).forEach(([filePath, file]) => {
               if (file.status !== "completed") {
                  file.progress = 0;
                  file.status = "cancelled";
               }
            });
         });
      },

      reset: () => {
         set((state) => {
            state.isUploading = false;
            state.uploadProgress = {};
            state.uploadQueue = [];
            state.completionToastShown = false;
         });
      },
   }))
);

export default useUploadStore;
