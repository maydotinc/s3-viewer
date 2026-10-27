import { useBucketContext } from "@/components/Buckets/Context";
import { toast } from "@s3-viewer/ui/components/toast";
import { filesFromDrop } from "@/lib/utils/s3/drop-entries";
import { visibleText } from "@/lib/utils/format";
import { toastFailure } from "@/lib/utils/toast";
import { cn } from "@s3-viewer/ui/lib/utils";
import { FolderLock, Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { STILL_CHECKING, useUploader } from "./provider";

const hasFiles = (event: React.DragEvent) =>
   Array.from(event.dataTransfer.types).includes("Files");

const DropZone = ({
   className,
   children,
}: {
   className?: string;
   children: React.ReactNode;
}) => {
   const { bucketName, prefix, isLoading } = useBucketContext();
   const { upload, isChecking, canUpload, blockedReason } = useUploader();
   const [dragging, setDragging] = useState(false);
   const depth = useRef(0);
   const walking = useRef(false);

   const onDragEnter = useCallback(
      (event: React.DragEvent) => {
         if (!hasFiles(event)) return;
         event.preventDefault();
         if (!canUpload && !blockedReason) return;
         depth.current += 1;
         setDragging(true);
      },
      [canUpload, blockedReason]
   );

   const onDragOver = useCallback(
      (event: React.DragEvent) => {
         if (!hasFiles(event)) return;
         event.preventDefault();
         event.dataTransfer.dropEffect = canUpload ? "copy" : "none";
      },
      [canUpload]
   );

   const onDragLeave = useCallback((event: React.DragEvent) => {
      const next = event.relatedTarget;
      // an element unmounting mid-drag never sends dragleave, so leaving the zone resets the count.
      depth.current =
         next instanceof Node && !event.currentTarget.contains(next)
            ? 0
            : Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
   }, []);

   const onDrop = useCallback(
      (event: React.DragEvent) => {
         depth.current = 0;
         setDragging(false);
         if (!hasFiles(event)) return;
         event.preventDefault();
         if (!canUpload || isLoading) return;
         if (isChecking || walking.current) {
            toast.error(STILL_CHECKING);
            return;
         }
         walking.current = true;
         void filesFromDrop(event.dataTransfer)
            .then(upload)
            .catch(toastFailure)
            .finally(() => {
               walking.current = false;
            });
      },
      [canUpload, isLoading, isChecking, upload]
   );

   return (
      <div
         className={cn("relative", className)}
         onDragEnter={onDragEnter}
         onDragOver={onDragOver}
         onDragLeave={onDragLeave}
         onDrop={onDrop}
      >
         {children}
         {dragging && canUpload && (
            <div
               className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-viewerblue bg-viewerwhite/90 px-4 text-center"
               aria-live="polite"
            >
               <Upload className="size-8 text-viewerblue" aria-hidden="true" />
               <p className="max-w-full text-sm font-medium text-viewerblack [overflow-wrap:anywhere]">
                  Drop to upload to {visibleText(prefix || bucketName)}
               </p>
            </div>
         )}
         {dragging && !canUpload && blockedReason && (
            <div
               className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-viewerborder bg-viewerwhite/90 px-4 text-center"
               aria-live="polite"
            >
               <FolderLock
                  className="size-8 text-viewerlighttext"
                  aria-hidden="true"
               />
               <p className="max-w-full text-sm font-medium text-viewerblack [overflow-wrap:anywhere]">
                  {blockedReason}
               </p>
            </div>
         )}
      </div>
   );
};

export default DropZone;
