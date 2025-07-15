import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

interface UploadProgress {
   [filePath: string]: {
      fileName: string;
      progress: number;
      fileSize: number;
      completed: boolean;
      cancelled?: boolean;
      cancelFn?: () => void | Promise<void>;
   };
}

export interface UploadParams {
   files: File[];
   bucketName: string;
   serverId?: string;
   prefix?: string;
   onProgress?: (
      filePath: string,
      progress: number,
      fileName: string,
      fileSize: number
   ) => void;
   onFileComplete?: (
      filePath: string,
      fileName: string,
      fileSize: number
   ) => void;
   onCancelReady?: (
      filePath: string,
      cancelFn: () => void | Promise<void>,
      fileSize: number
   ) => void;
}

interface MutateOptions {
   onSuccess?: (
      data: { message: string; filesUploaded: number },
      variables: UploadParams
   ) => void;
   onError?: (error: Error) => void;
}

type MutateFunction = (params: UploadParams, options?: MutateOptions) => void;

type UploadStoreState = {
   isUploading: boolean;
   uploadProgress: UploadProgress;
   mutate: MutateFunction | null;
   onUploadComplete?: () => void;
};

type UploadStoreActions = {
   init: (mutateFunction: MutateFunction) => void;
   setOnUploadComplete: (callback: () => void) => void;
   startUpload: (params: {
      files: File[];
      bucketName: string;
      serverId: string;
      prefix: string;
   }) => void;
   setProgress: (
      filePath: string,
      progress: number,
      fileName: string,
      fileSize: number
   ) => void;
   setFileComplete: (
      filePath: string,
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
   stopAllPendingUploads: () => void;
   reset: () => void;
};

type UploadStore = UploadStoreState & UploadStoreActions;

const useUploadStore = create<UploadStore>()(
   immer((set, get) => ({
      isUploading: false,
      uploadProgress: {},
      mutate: null,
      onUploadComplete: undefined,

      init: (mutateFunction) => {
         set((state) => {
            state.mutate = mutateFunction;
         });
      },

      setOnUploadComplete: (callback) => {
         set((state) => {
            state.onUploadComplete = callback;
         });
      },

      startUpload: (params) => {
         const { mutate, onUploadComplete } = get();
         if (!mutate) {
            console.error("Upload mutation not initialized.");
            return;
         }

         set((state) => {
            state.isUploading = true;
            state.uploadProgress = {};
         });

         mutate(
            {
               ...params,
               onProgress: (filePath, progress, fileName, fileSize) => {
                  get().setProgress(filePath, progress, fileName, fileSize);
               },
               onFileComplete: (filePath, fileName, fileSize) => {
                  get().setFileComplete(filePath, fileName, fileSize);
               },
               onCancelReady: (filePath, cancelFn, fileSize) => {
                  get().setCancelFunction(filePath, cancelFn, fileSize);
               },
            },
            {
               onSuccess: (data, variables) => {
                  set((state) => {
                     state.isUploading = false;
                  });
                  onUploadComplete?.();
                  get().stopAllPendingUploads();
               },
               onError: (error) => {
                  console.error("Upload failed from store:", error);

                  set((state) => {
                     const hasUploads =
                        Object.keys(state.uploadProgress).length > 0;
                     const hasCompletedUploads = Object.values(
                        state.uploadProgress
                     ).some((file) => file.completed);

                     if (!hasUploads) {
                        state.isUploading = false;
                        state.uploadProgress = {};
                     } else {
                        state.isUploading = false;
                        Object.values(state.uploadProgress).forEach((file) => {
                           if (!file.completed) {
                              file.cancelled = true;
                              file.progress = 0;
                           }
                        });
                     }
                     if (hasCompletedUploads) onUploadComplete?.();
                  });
               },
            }
         );
      },

      setProgress: (filePath, progress, fileName, fileSize) => {
         set((state) => {
            if (!state.uploadProgress[filePath]) {
               state.uploadProgress[filePath] = {
                  fileName,
                  progress,
                  fileSize,
                  completed: false,
               };
            } else {
               state.uploadProgress[filePath].fileName = fileName;
               state.uploadProgress[filePath].progress = progress;
               state.uploadProgress[filePath].fileSize = fileSize;
               state.uploadProgress[filePath].completed = false;
            }
         });
      },

      setFileComplete: (filePath, fileName, fileSize) => {
         set((state) => {
            if (!state.uploadProgress[filePath]) {
               state.uploadProgress[filePath] = {
                  fileName,
                  progress: 100,
                  fileSize,
                  completed: true,
               };
            } else {
               state.uploadProgress[filePath].fileName = fileName;
               state.uploadProgress[filePath].progress = 100;
               state.uploadProgress[filePath].fileSize = fileSize;
               state.uploadProgress[filePath].completed = true;
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
                  completed: false,
                  cancelFn,
               };
            } else {
               state.uploadProgress[filePath].cancelFn = cancelFn;
            }
         });
      },

      cancelUpload: (filePath) => {
         const { uploadProgress } = get();
         const fileUpload = uploadProgress[filePath];

         if (fileUpload?.cancelFn && !fileUpload.completed) {
            const result = fileUpload.cancelFn();

            // Handle potential Promise return
            if (result instanceof Promise) {
               result.catch((error) => {
                  console.error(
                     `Error cancelling upload for file ${filePath}:`,
                     error
                  );
               });
            }

            set((state) => {
               if (state.uploadProgress[filePath]) {
                  state.uploadProgress[filePath].cancelled = true;
                  state.uploadProgress[filePath].progress = 0;
               }
            });
         }
      },

      cancelAllUploads: () => {
         const { uploadProgress } = get();

         Object.entries(uploadProgress).forEach(([filePath, fileUpload]) => {
            if (fileUpload.cancelFn && !fileUpload.completed) {
               const result = fileUpload.cancelFn();

               // Handle potential Promise return
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
            Object.entries(state.uploadProgress).forEach(([filePath, file]) => {
               if (!file.completed) {
                  file.cancelled = true;
                  file.progress = 0;
               }
            });
         });
      },

      stopAllPendingUploads: () => {
         set((state) => {
            Object.entries(state.uploadProgress).forEach(([_, fileUpload]) => {
               if (!fileUpload.completed) {
                  fileUpload.cancelled = true;
                  fileUpload.progress = 0;
               }
            });
         });
      },

      reset: () => {
         set((state) => {
            state.isUploading = false;
            state.uploadProgress = {};
         });
      },
   }))
);

export default useUploadStore;
