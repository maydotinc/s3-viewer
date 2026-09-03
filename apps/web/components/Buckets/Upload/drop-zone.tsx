import { useBucketContext } from "@/components/Buckets/Context";
import { usePermission } from "@/lib/hooks/usePermission";
import { filesFromDrop } from "@/lib/utils/s3/dropEntries";
import { Permission } from "@s3-viewer/permissions";
import { cn } from "@s3-viewer/ui/lib/utils";
import { Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useUploader } from "./provider";

const hasFiles = (event: React.DragEvent) =>
   Array.from(event.dataTransfer.types).includes("Files");

const DropZone = ({
   className,
   children,
}: {
   className?: string;
   children: React.ReactNode;
}) => {
   const { bucketName, prefix } = useBucketContext();
   const canUpload = usePermission(Permission.UPLOAD_OBJECT, bucketName);
   const { upload } = useUploader();
   const [dragging, setDragging] = useState(false);
   const depth = useRef(0);

   const onDragEnter = useCallback(
      (event: React.DragEvent) => {
         if (!canUpload || !hasFiles(event)) return;
         event.preventDefault();
         depth.current += 1;
         setDragging(true);
      },
      [canUpload]
   );

   const onDragOver = useCallback(
      (event: React.DragEvent) => {
         if (!canUpload || !hasFiles(event)) return;
         event.preventDefault();
         event.dataTransfer.dropEffect = "copy";
      },
      [canUpload]
   );

   const onDragLeave = useCallback(() => {
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
   }, []);

   const onDrop = useCallback(
      (event: React.DragEvent) => {
         depth.current = 0;
         setDragging(false);
         if (!canUpload || !hasFiles(event)) return;
         event.preventDefault();
         void filesFromDrop(event.dataTransfer).then(upload);
      },
      [canUpload, upload]
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
         {dragging && (
            <div
               className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-viewerblue bg-viewerwhite/90"
               aria-live="polite"
            >
               <Upload className="size-8 text-viewerblue" aria-hidden="true" />
               <p className="text-sm font-medium text-viewerblack">
                  Drop to upload to {prefix ? prefix : bucketName}
               </p>
            </div>
         )}
      </div>
   );
};

export default DropZone;
