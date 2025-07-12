import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

interface UploadProgress {
   [fileIndex: number]: {
      fileName: string;
      progress: number;
      fileSize: number;
      completed: boolean;
      cancelled?: boolean;
      cancelFn?: () => void;
   };
}

interface UploadParams {
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
      stopAllPendingUploads?: () => void;
   }) => void;
   setProgress: (
      fileIndex: number,
      progress: number,
      fileName: string,
      fileSize: number
   ) => void;
   setFileComplete: (
      fileIndex: number,
      fileName: string,
      fileSize: number
   ) => void;
   setCancelFunction: (
      fileIndex: number,
      cancelFn: () => void,
      fileSize: number
   ) => void;
   cancelUpload: (fileIndex: number) => void;
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
               onProgress: (fileIndex, progress, fileName, fileSize) => {
                  get().setProgress(fileIndex, progress, fileName, fileSize);
               },
               onFileComplete: (fileIndex, fileName, fileSize) => {
                  get().setFileComplete(fileIndex, fileName, fileSize);
               },
               onCancelReady: (fileIndex, cancelFn, fileSize) => {
                  get().setCancelFunction(fileIndex, cancelFn, fileSize);
               },
            },
            {
               onSuccess: (data, variables) => {
                  set((state) => {
                     state.isUploading = false;
                  });
                  onUploadComplete?.();
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

      setProgress: (fileIndex, progress, fileName, fileSize) => {
         set((state) => {
            if (!state.uploadProgress[fileIndex]) {
               state.uploadProgress[fileIndex] = {
                  fileName,
                  progress,
                  fileSize,
                  completed: false,
               };
            } else {
               state.uploadProgress[fileIndex].fileName = fileName;
               state.uploadProgress[fileIndex].progress = progress;
               state.uploadProgress[fileIndex].fileSize = fileSize;
               state.uploadProgress[fileIndex].completed = false;
            }
         });
      },

      setFileComplete: (fileIndex, fileName, fileSize) => {
         set((state) => {
            if (!state.uploadProgress[fileIndex]) {
               state.uploadProgress[fileIndex] = {
                  fileName,
                  progress: 100,
                  fileSize,
                  completed: true,
               };
            } else {
               state.uploadProgress[fileIndex].fileName = fileName;
               state.uploadProgress[fileIndex].progress = 100;
               state.uploadProgress[fileIndex].fileSize = fileSize;
               state.uploadProgress[fileIndex].completed = true;
            }
         });
      },

      setCancelFunction: (fileIndex, cancelFn, fileSize) => {
         set((state) => {
            if (!state.uploadProgress[fileIndex]) {
               state.uploadProgress[fileIndex] = {
                  fileName: "",
                  progress: 0,
                  fileSize,
                  completed: false,
                  cancelFn,
               };
            } else {
               state.uploadProgress[fileIndex].cancelFn = cancelFn;
            }
         });
      },

      cancelUpload: (fileIndex) => {
         const { uploadProgress } = get();
         const fileUpload = uploadProgress[fileIndex];

         if (fileUpload?.cancelFn && !fileUpload.completed) {
            fileUpload.cancelFn();

            set((state) => {
               if (state.uploadProgress[fileIndex]) {
                  state.uploadProgress[fileIndex].cancelled = true;
                  state.uploadProgress[fileIndex].progress = 0;
               }
            });
         }
      },

      cancelAllUploads: () => {
         const { uploadProgress } = get();

         Object.entries(uploadProgress).forEach(([fileIndex, fileUpload]) => {
            if (fileUpload.cancelFn && !fileUpload.completed) {
               fileUpload.cancelFn();
            }
         });

         set((state) => {
            state.isUploading = false;
            Object.entries(state.uploadProgress).forEach(([index, file]) => {
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
