import useUploadStore from "@/lib/stores/uploadStore";
import { formatFileSize } from "@/lib/utils/fileUtils";
import {
   CheckCircle,
   ChevronUp,
   File,
   RefreshCcw,
   RefreshCwOff,
   X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const UploadProgressSheet = () => {
   const {
      uploadProgress,
      cancelUpload,
      isUploading,
      reset,
      cancelAllUploads,
   } = useUploadStore();
   const [isExpanded, setIsExpanded] = useState(false);
   const progressSheetRef = useRef<HTMLDivElement>(null);
   const totalUploads = Object.keys(uploadProgress).length;
   const completedUploads = Object.values(uploadProgress).filter(
      (file) => file.completed
   ).length;

   const handleClose = () => {
      if (isUploading) {
         cancelAllUploads();
      }
      reset();
   };

   useEffect(() => {
      const handleOutsideClick = (event: MouseEvent) => {
         if (
            progressSheetRef.current &&
            !progressSheetRef.current.contains(event.target as Node)
         ) {
            setIsExpanded((state) => false);
         }
      };

      const handleKeyDown = (event: KeyboardEvent) => {
         if (event.key === "Escape") {
            event.preventDefault();
            setIsExpanded((state) => false);
         }
      };

      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("keydown", handleKeyDown);
      return () => {
         document.removeEventListener("mousedown", handleOutsideClick);
         document.removeEventListener("keydown", handleKeyDown);
      };
   }, []);

   const shouldShow = isUploading || Object.values(uploadProgress).length > 0;
   if (!shouldShow) return null;

   return (
      <div
         className="fixed bottom-0 right-8 z-50 transition-transform duration-300 ease-in-out [--header-height:58px] [--content-height:350px]"
         ref={progressSheetRef}
      >
         <div
            className={`bg-white border border-viewerborder box-border rounded-t-2xl  w-[400px] shadow-lg transition-all duration-300 ease-in-out overflow-hidden ${
               isExpanded
                  ? "max-h-[calc(var(--content-height)+var(--header-height))]"
                  : "max-h-[var(--header-height)]"
            }`}
         >
            <div
               onClick={() => setIsExpanded((prev) => !prev)}
               className="flex items-center justify-between p-4 bg-viewergray border-b border-viewerborder rounded-t-2xl h-[var(--header-height)]"
            >
               <div className="flex items-center gap-2">
                  {isUploading ? (
                     <>
                        <RefreshCcw className="size-4 animate-spin text-viewerblue" />
                        <span className="text-sm font-medium">
                           Uploads completed ({completedUploads}/{totalUploads})
                        </span>
                     </>
                  ) : (
                     <>
                        <CheckCircle className="size-4 text-green-500" />
                        <span className="text-sm font-medium">
                           Operations complete ({completedUploads}/
                           {totalUploads})
                        </span>
                     </>
                  )}
               </div>

               <div className="flex items-center gap-4">
                  <ChevronUp
                     className={`size-4 ${isExpanded ? "rotate-180" : ""} transition-transform duration-300`}
                  />
                  <X
                     className="size-3.5 cursor-pointer hover:text-viewertextred"
                     onClick={(e) => {
                        e.stopPropagation();
                        handleClose();
                     }}
                  />
               </div>
            </div>

            <div
               className={`transition-all duration-300 ease-in-out overflow-hidden ${
                  isExpanded ? "max-h-[var(--content-height)]" : "max-h-0"
               }`}
            >
               <div className="flex flex-col overflow-y-auto max-h-[var(--content-height)] gap-2 p-2">
                  {Object.entries(uploadProgress).map(([filePath, file]) => {
                     const { value: fileSizeFormatted, unit: suffix } =
                        formatFileSize(file.fileSize);
                     const uploadedSize = Math.round(
                        (fileSizeFormatted * file.progress) / 100
                     );

                     let stateSymbol = null;
                     if (file.cancelled) {
                        stateSymbol = (
                           <RefreshCwOff className="size-3.5 text-red-500" />
                        );
                     } else if (file.completed) {
                        stateSymbol = (
                           <CheckCircle className="size-3.5 text-green-500" />
                        );
                     } else {
                        stateSymbol = (
                           <RefreshCcw className="size-3.5 animate-spin" />
                        );
                     }

                     return (
                        <div
                           key={filePath}
                           className="flex flex-col justify-center gap-2 p-2 rounded-xl border border-viewerborder"
                        >
                           <div className="flex justify-between">
                              <div className="flex items-center gap-2">
                                 <File className="size-8 text-viewerborder" />
                                 <div className="flex flex-col">
                                    <p className="text-sm font-medium text-viewertext truncate max-w-[200px]">
                                       {file.fileName}
                                    </p>
                                    <div className="flex items-center gap-2">
                                       <p className="text-xs text-viewerlighttext truncate">
                                          {`${uploadedSize} ${suffix} of ${fileSizeFormatted} ${suffix}`}
                                       </p>
                                       <div className="rounded-full bg-viewerlighttext w-0.5 h-0.5" />
                                       <div className="flex items-center gap-1">
                                          {stateSymbol}
                                       </div>
                                    </div>
                                 </div>
                              </div>
                              <div
                                 className="flex gap-2"
                                 onClick={() => {
                                    cancelUpload(filePath);
                                 }}
                                 hidden={file.completed || file.cancelled}
                              >
                                 <X className="size-3.5" />
                              </div>
                           </div>
                           {!file.completed && !file.cancelled && (
                              <div className="w-full h-1.5 bg-viewerborder rounded-full">
                                 <div
                                    className="h-1.5 rounded-full transition-all duration-300 bg-viewerblue"
                                    style={{ width: `${file.progress}%` }}
                                 />
                              </div>
                           )}
                        </div>
                     );
                  })}
                  {totalUploads === 0 && (
                     <div className="text-center py-8">
                        <File className="size-8 mx-auto mb-2 opacity-50" />
                        <p className="text-gray-500">
                           No active uploads or downloads
                        </p>
                     </div>
                  )}
               </div>
            </div>
         </div>
      </div>
   );
};

export default UploadProgressSheet;
