import useUploadStore from "@/lib/stores/upload-store/uploadStore";
import type { UploadEntry } from "@/lib/stores/upload-store/types";
import { formatBytes } from "@/lib/utils/format";
import { Button } from "@s3-viewer/ui/components/button";
import { cn } from "@s3-viewer/ui/lib/utils";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Spinner } from "@s3-viewer/ui/components/spinner";
import {
   Ban,
   CheckCircle2,
   ChevronUp,
   Circle,
   CircleAlert,
   File,
   X,
} from "lucide-react";
import { useId, useRef, useState } from "react";

const ROW_HEIGHT = 68;
const ROW_GAP = 8;

const percent = (entry: UploadEntry) => {
   if (entry.status === "completed") return 100;
   if (entry.size === 0) return 0;
   return Math.min(100, Math.round((entry.uploadedBytes / entry.size) * 100));
};

const StatusIcon = ({ status }: { status: UploadEntry["status"] }) => {
   switch (status) {
      case "completed":
         return (
            <CheckCircle2
               className="size-3.5 text-viewerblue"
               role="img"
               aria-label="Uploaded"
            />
         );
      case "failed":
         return (
            <CircleAlert
               className="size-3.5 text-viewertextred"
               role="img"
               aria-label="Failed"
            />
         );
      case "cancelled":
         return (
            <Ban
               className="size-3.5 text-viewerlighttext"
               role="img"
               aria-label="Cancelled"
            />
         );
      case "active":
         return <Spinner size="sm" className="size-3.5" label="Uploading…" />;
      default:
         return (
            <Circle
               className="size-3.5 text-viewerlighttext"
               role="img"
               aria-label="Waiting…"
            />
         );
   }
};

const UploadRow = ({
   entry,
   onCancel,
}: {
   entry: UploadEntry;
   onCancel: () => void;
}) => {
   const value = percent(entry);
   const cancellable = entry.status === "pending" || entry.status === "active";
   return (
      <div className="flex h-full flex-col justify-center gap-2 rounded-xl border border-viewerborder p-2">
         <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
               <File
                  className="size-7 shrink-0 text-viewerborder"
                  aria-hidden="true"
               />
               <div className="flex min-w-0 flex-col">
                  <p
                     className="truncate text-sm font-medium text-viewertext"
                     title={entry.relativePath}
                  >
                     {entry.relativePath}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-viewerlighttext">
                     <span className="truncate">
                        {entry.status === "failed" && entry.error
                           ? entry.error
                           : `${formatBytes(entry.uploadedBytes)} of ${formatBytes(entry.size)}`}
                     </span>
                     <StatusIcon status={entry.status} />
                  </div>
               </div>
            </div>
            <Button
               variant="ghost"
               size="icon"
               className={cn("size-7 shrink-0", !cancellable && "invisible")}
               aria-label={`Cancel upload of ${entry.fileName}`}
               tabIndex={cancellable ? 0 : -1}
               onClick={onCancel}
            >
               <X className="size-3.5" aria-hidden="true" />
            </Button>
         </div>
         <div
            className="h-1.5 w-full rounded-full bg-viewerborder"
            role="progressbar"
            aria-label={`${entry.fileName} upload progress`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={value}
         >
            <div
               className={cn(
                  "h-1.5 rounded-full transition-[width] duration-150",
                  entry.status === "failed"
                     ? "bg-viewertextred"
                     : "bg-viewerblue"
               )}
               style={{ width: `${value}%` }}
            />
         </div>
      </div>
   );
};

const UploadList = ({
   ids,
   cancel,
}: {
   ids: string[];
   cancel: (id: string) => void;
}) => {
   const entries = useUploadStore((state) => state.entries);
   const containerRef = useRef<HTMLDivElement>(null);
   const virtualizer = useVirtualizer({
      count: ids.length,
      getScrollElement: () => containerRef.current,
      estimateSize: () => ROW_HEIGHT,
      gap: ROW_GAP,
   });

   return (
      <div ref={containerRef} className="max-h-[350px] overflow-y-auto p-2">
         <div
            className="relative"
            style={{ height: `${virtualizer.getTotalSize()}px` }}
         >
            {virtualizer.getVirtualItems().map((item) => {
               const id = ids[item.index];
               const entry = id ? entries[id] : undefined;
               if (!id || !entry) return null;
               return (
                  <div
                     key={item.key}
                     className="absolute left-0 top-0 w-full"
                     style={{
                        transform: `translateY(${item.start}px)`,
                        height: `${item.size}px`,
                     }}
                  >
                     <UploadRow entry={entry} onCancel={() => cancel(id)} />
                  </div>
               );
            })}
         </div>
      </div>
   );
};

const UploadProgressSheet = () => {
   const order = useUploadStore((state) => state.order);
   const entries = useUploadStore((state) => state.entries);
   const batch = useUploadStore((state) => state.batch);
   const isUploading = useUploadStore((state) => state.isUploading);
   const cancel = useUploadStore((state) => state.cancel);
   const cancelAll = useUploadStore((state) => state.cancelAll);
   const dismiss = useUploadStore((state) => state.dismiss);
   const [expanded, setExpanded] = useState(false);
   const panelId = useId();

   if (order.length === 0) return null;

   const batchIds = batch?.ids ?? [];
   const done = batchIds.filter(
      (id) => entries[id]?.status === "completed"
   ).length;
   const failed = batchIds.filter(
      (id) => entries[id]?.status === "failed"
   ).length;
   const heading = isUploading
      ? `Uploading… (${done}/${batchIds.length})`
      : failed > 0
        ? `${failed} of ${batchIds.length} ${batchIds.length === 1 ? "upload" : "uploads"} failed`
        : "Uploads complete";

   return (
      <div
         className="fixed bottom-0 right-8 z-50"
         onKeyDown={(event) => {
            if (event.key === "Escape" && expanded) setExpanded(false);
         }}
      >
         <div className="w-[400px] overflow-hidden rounded-t-2xl border border-viewerborder bg-viewerwhite shadow-lg">
            <div className="flex h-14 items-center justify-between gap-2 border-b border-viewerborder bg-viewergray px-3">
               <Button
                  variant="ghost"
                  size="sm"
                  className="min-w-0 flex-1 justify-start px-1 text-viewerblack"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  onClick={() => setExpanded((open) => !open)}
               >
                  {isUploading ? (
                     <Spinner size="sm" label="Uploading" />
                  ) : (
                     <CheckCircle2
                        className="size-4 shrink-0 text-viewerblue"
                        aria-hidden="true"
                     />
                  )}
                  <span className="min-w-0 truncate" role="status">
                     {heading}
                  </span>
                  <ChevronUp
                     className={cn(
                        "ml-auto size-4 shrink-0",
                        expanded && "rotate-180"
                     )}
                     aria-hidden="true"
                  />
               </Button>
               {isUploading && (
                  <Button variant="ghost" size="sm" onClick={cancelAll}>
                     Cancel all
                  </Button>
               )}
               <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label={
                     isUploading ? "Cancel uploads and close" : "Close"
                  }
                  onClick={dismiss}
               >
                  <X className="size-3.5" aria-hidden="true" />
               </Button>
            </div>
            <div id={panelId} hidden={!expanded}>
               <UploadList ids={order} cancel={cancel} />
            </div>
         </div>
      </div>
   );
};

export default UploadProgressSheet;
