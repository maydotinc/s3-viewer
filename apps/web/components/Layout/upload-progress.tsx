import { ConfirmDialog } from "@/components/Modals/confirm-dialog";
import { useBeforeUnload } from "@/lib/hooks/useBeforeUnload";
import useUploadStore from "@/lib/stores/upload-store/upload-store";
import type { UploadBatch, UploadEntry } from "@/lib/stores/upload-store/types";
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
import { memo, useCallback, useId, useRef, useState } from "react";

const ROW_HEIGHT = 68;
const ROW_GAP = 8;

const perSecond = (rate: number) => `${formatBytes(rate)}/s`;

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

const UploadRow = memo(function UploadRow({
   entry,
   rate,
   onCancel,
}: {
   entry: UploadEntry;
   rate: number | undefined;
   onCancel: () => void;
}) {
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
                           : `${formatBytes(entry.uploadedBytes)} of ${formatBytes(entry.size)}${entry.status === "active" && rate !== undefined ? ` · ${perSecond(rate)}` : ""}`}
                     </span>
                     <StatusIcon status={entry.status} />
                  </div>
               </div>
            </div>
            <Button
               variant="ghost"
               size="icon"
               className={cn(
                  // the row is too short for a 44px button, so touch gets a larger hit area instead.
                  "relative size-7 shrink-0 pointer-coarse:after:absolute pointer-coarse:after:-inset-2",
                  !cancellable && "invisible"
               )}
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
});

const UploadRowItem = memo(function UploadRowItem({
   id,
   cancel,
}: {
   id: string;
   cancel: (id: string) => void;
}) {
   const entry = useUploadStore((state) => state.entries[id]);
   const progress = useUploadStore((state) => state.progress[id]);
   const rate = useUploadStore((state) => state.rates[id]);
   const onCancel = useCallback(() => cancel(id), [cancel, id]);
   if (!entry) return null;
   return (
      <UploadRow
         entry={
            progress === undefined
               ? entry
               : { ...entry, uploadedBytes: progress }
         }
         rate={rate}
         onCancel={onCancel}
      />
   );
});

const UploadList = ({
   ids,
   cancel,
}: {
   ids: string[];
   cancel: (id: string) => void;
}) => {
   const containerRef = useRef<HTMLDivElement>(null);
   const virtualizer = useVirtualizer({
      count: ids.length,
      getScrollElement: () => containerRef.current,
      estimateSize: () => ROW_HEIGHT,
      gap: ROW_GAP,
   });

   return (
      <div
         ref={containerRef}
         className="h-[min(350px,calc(100dvh-8rem))] min-h-0 overflow-y-auto p-2 [scrollbar-gutter:stable]"
      >
         <div
            className="relative"
            style={{ height: `${virtualizer.getTotalSize()}px` }}
         >
            {virtualizer.getVirtualItems().map((item) => {
               const id = ids[item.index];
               if (!id) return null;
               return (
                  <div
                     key={item.key}
                     className="absolute left-0 top-0 w-full"
                     style={{
                        transform: `translateY(${item.start}px)`,
                        height: `${item.size}px`,
                     }}
                  >
                     <UploadRowItem id={id} cancel={cancel} />
                  </div>
               );
            })}
         </div>
      </div>
   );
};

type SheetStatus = {
   tone: "uploading" | "failed" | "cancelled" | "complete";
   heading: string;
};

const uploads = (count: number) => (count === 1 ? "upload" : "uploads");

// the sum of every active upload, so the collapsed sheet shows what the connection is doing
const selectTotalRate = (state: { rates: Record<string, number> }) => {
   let total: number | undefined;
   for (const rate of Object.values(state.rates)) total = (total ?? 0) + rate;
   return total;
};

const sheetStatus = (
   isUploading: boolean,
   batch: UploadBatch | null,
   rate?: number
): SheetStatus => {
   const total = batch?.ids.length ?? 0;
   const done = batch?.completed ?? 0;
   const failed = batch?.failed ?? 0;
   const cancelled = Math.max(0, total - done - failed);
   if (isUploading)
      return {
         tone: "uploading",
         heading: `Uploading… (${done}/${total})${rate === undefined ? "" : ` · ${perSecond(rate)}`}`,
      };
   if (failed > 0)
      return {
         tone: "failed",
         heading: `${failed} of ${total} ${uploads(total)} failed`,
      };
   if (cancelled > 0)
      return {
         tone: "cancelled",
         heading:
            done === 0
               ? "Uploads cancelled"
               : `${cancelled} of ${total} ${uploads(total)} cancelled`,
      };
   return { tone: "complete", heading: "Uploads complete" };
};

const SheetIcon = ({ tone }: { tone: SheetStatus["tone"] }) => {
   switch (tone) {
      case "uploading":
         return <Spinner size="sm" label="Uploading" />;
      case "failed":
         return (
            <CircleAlert
               className="size-4 shrink-0 text-viewertextred"
               aria-hidden="true"
            />
         );
      case "cancelled":
         return (
            <Ban
               className="size-4 shrink-0 text-viewerlighttext"
               aria-hidden="true"
            />
         );
      default:
         return (
            <CheckCircle2
               className="size-4 shrink-0 text-viewerblue"
               aria-hidden="true"
            />
         );
   }
};

const UploadProgressSheet = () => {
   const order = useUploadStore((state) => state.order);
   const batch = useUploadStore((state) => state.batch);
   const isUploading = useUploadStore((state) => state.isUploading);
   const rate = useUploadStore(selectTotalRate);
   const cancel = useUploadStore((state) => state.cancel);
   const cancelAll = useUploadStore((state) => state.cancelAll);
   const cancelAllAndClear = useUploadStore((state) => state.cancelAllAndClear);
   const [expanded, setExpanded] = useState(false);
   const [confirmingClose, setConfirmingClose] = useState(false);
   const panelId = useId();
   useBeforeUnload(isUploading);

   if (order.length === 0) return null;

   const { tone, heading } = sheetStatus(isUploading, batch, rate);

   return (
      <>
         <div
            className="fixed inset-x-0 bottom-0 z-50 md:inset-x-auto md:right-6 md:bottom-6 md:w-[400px]"
            onKeyDown={(event) => {
               if (
                  event.key !== "Escape" ||
                  event.defaultPrevented ||
                  !expanded
               )
                  return;
               event.preventDefault();
               setExpanded(false);
            }}
         >
            <div className="w-full overflow-hidden rounded-t-2xl border border-b-0 border-viewerborder bg-viewerwhite shadow-lg md:rounded-2xl md:border-b">
               <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-viewerborder bg-viewergray px-3">
                  <Button
                     variant="ghost"
                     size="sm"
                     className="min-w-0 flex-1 justify-start px-1 text-viewerblack"
                     aria-expanded={expanded}
                     aria-controls={panelId}
                     onClick={() => setExpanded((open) => !open)}
                  >
                     <SheetIcon tone={tone} />
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
                  <Button
                     variant="ghost"
                     size="sm"
                     onClick={cancelAll}
                     className={cn("shrink-0", !isUploading && "invisible")}
                     disabled={!isUploading}
                     aria-hidden={!isUploading}
                  >
                     Cancel all
                  </Button>
                  <Button
                     variant="ghost"
                     size="icon"
                     className="size-7 shrink-0 pointer-coarse:size-11"
                     aria-label={
                        isUploading ? "Cancel uploads and close" : "Close"
                     }
                     onClick={() => {
                        if (isUploading) setConfirmingClose(true);
                        else void cancelAllAndClear();
                     }}
                  >
                     <X className="size-3.5" aria-hidden="true" />
                  </Button>
               </div>
               <div id={panelId} hidden={!expanded}>
                  {expanded && <UploadList ids={order} cancel={cancel} />}
               </div>
            </div>
         </div>
         <ConfirmDialog
            open={confirmingClose}
            onClose={() => setConfirmingClose(false)}
            title="Stop uploading?"
            description="Closing this panel cancels every upload that hasn't finished."
            confirmLabel="Stop uploads"
            onConfirm={() => {
               setConfirmingClose(false);
               void cancelAllAndClear();
            }}
         />
      </>
   );
};

export default UploadProgressSheet;
export { sheetStatus };
