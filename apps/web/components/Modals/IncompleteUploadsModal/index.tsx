import CenteredSpinner from "@/components/centered-spinner";
import type { ModalProps } from "@/lib/contexts/modal-props";
import { FormDialog } from "@/components/Modals/form-dialog";
import FormError from "@/components/Modals/form-error";
import { errorMessage, isAborted } from "@/lib/api";
import useAbortMultipartUploads, {
   pairId,
} from "@/lib/hooks/mutations/object/useAbortMultipartUploads";
import useBucketScope from "@/lib/hooks/queries/s3/useBucketScope";
import useMultipartUploads from "@/lib/hooks/queries/s3/useMultipartUploads";
import { useAbortableTask } from "@/lib/hooks/useAbortableTask";
import { canListPrefix, uploadsScope } from "@/lib/utils/folder-access";
import {
   formatCount,
   formatDate,
   formatRelativeDay,
   visibleText,
} from "@/lib/utils/format";
import type { S3MultipartUpload, S3UploadFailure } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { Checkbox } from "@s3-viewer/ui/components/checkbox";
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "@s3-viewer/ui/components/table";
import { RefreshCw } from "lucide-react";
import { useState } from "react";

type IncompleteUploadsModalProps = ModalProps<"incompleteUploads">;

const CANCELLED =
   "Cancelled. Some uploads may already be aborted — refresh to see what is left.";

const IncompleteUploadsModal = ({
   onClose,
   userId,
   serverId,
   bucketName,
   prefix,
   onAborted,
}: IncompleteUploadsModalProps) => {
   const reach = useBucketScope(userId, serverId, bucketName);
   const {
      uploads,
      isLoading,
      isFetching,
      error: listError,
      hasNextPage,
      isFetchingNextPage,
      fetchNextPage,
      refetch,
   } = useMultipartUploads(
      serverId,
      bucketName,
      prefix,
      canListPrefix(reach, prefix)
   );
   const abortUploads = useAbortMultipartUploads();
   const [selected, setSelected] = useState<string[]>([]);
   const [confirmAll, setConfirmAll] = useState(false);
   const [failed, setFailed] = useState<S3UploadFailure[]>([]);
   const [error, setError] = useState<string | null>(null);
   const [busy, setBusy] = useState(false);
   const task = useAbortableTask();

   const chosen = new Set(selected);
   const picked = uploads.filter((upload) => chosen.has(pairId(upload)));
   const failures = new Map(
      failed.map((failure) => [pairId(failure), failure.message])
   );

   const toggle = (upload: S3MultipartUpload) => {
      const id = pairId(upload);
      setSelected(
         chosen.has(id)
            ? selected.filter((value) => value !== id)
            : [...selected, id]
      );
      setConfirmAll(false);
   };

   const run = (targets: S3MultipartUpload[]) => {
      if (busy || targets.length === 0) return;
      setError(null);
      setBusy(true);
      abortUploads.mutate(
         {
            userId,
            serverId,
            bucketName,
            uploads: targets,
            signal: task.start(),
         },
         {
            onSuccess: (summary) =>
               task.ifMounted(() => {
                  setBusy(false);
                  setConfirmAll(false);
                  setFailed(summary.failed);
                  if (summary.aborted > 0) onAborted?.();
                  if (summary.cancelled) {
                     setError(CANCELLED);
                     return;
                  }
                  setSelected(summary.failed.map(pairId));
                  if (
                     summary.failed.length === 0 &&
                     uploads.length === targets.length &&
                     !hasNextPage
                  )
                     onClose();
               }),
            onError: (failure) =>
               task.ifMounted(() => {
                  setBusy(false);
                  setError(
                     isAborted(failure) ? CANCELLED : errorMessage(failure)
                  );
               }),
         }
      );
   };

   const refresh = () => {
      if (busy) return;
      setError(null);
      setFailed([]);
      setConfirmAll(false);
      void refetch();
   };

   const scope = uploadsScope(reach, prefix);
   const notice =
      error ??
      (listError
         ? errorMessage(listError)
         : failed.length > 0
           ? `${formatCount(failed.length)} of these uploads could not be aborted.`
           : null);

   return (
      <FormDialog
         onClose={onClose}
         isPending={busy}
         onAbort={() => task.cancel()}
         contentClassName="max-w-2xl"
         title="Incomplete uploads"
         description={`Multipart uploads ${scope} that were started but never finished. Their parts keep taking up space until they are aborted.`}
         onSubmit={(event) => {
            event.preventDefault();
            run(picked);
         }}
         submitLabel={
            picked.length > 0
               ? `Abort selected (${formatCount(picked.length)})`
               : "Abort selected"
         }
         submitDisabled={picked.length === 0}
      >
         <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-viewertext">
               {isLoading
                  ? "Loading…"
                  : `${formatCount(uploads.length)} listed${hasNextPage ? "+" : ""}`}
            </p>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
               <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy || isFetching}
                  onClick={refresh}
               >
                  <RefreshCw aria-hidden="true" />
                  Refresh
               </Button>
               <Button
                  type="button"
                  variant={confirmAll ? "destructive" : "outline"}
                  size="sm"
                  disabled={busy || uploads.length === 0}
                  onClick={() =>
                     confirmAll ? run(uploads) : setConfirmAll(true)
                  }
               >
                  {confirmAll
                     ? `Confirm aborting ${formatCount(uploads.length)}`
                     : "Abort all listed"}
               </Button>
            </div>
         </div>
         <FormError>{notice}</FormError>
         {isLoading ? (
            <CenteredSpinner
               label="Loading incomplete uploads"
               className="min-h-32"
            />
         ) : uploads.length === 0 ? (
            <p className="flex min-h-32 items-center justify-center break-words text-center text-sm text-viewertext">
               {hasNextPage
                  ? "Load more to check for more incomplete uploads."
                  : `No incomplete uploads ${scope}.`}
            </p>
         ) : (
            <div className="max-h-96 min-h-0 overflow-auto rounded-md border border-viewerborder [scrollbar-gutter:stable]">
               <Table>
                  <TableHeader>
                     <TableRow>
                        <TableHead className="w-10" />
                        <TableHead>Key</TableHead>
                        <TableHead className="w-44">Started</TableHead>
                        <TableHead className="w-28">Age</TableHead>
                     </TableRow>
                  </TableHeader>
                  <TableBody>
                     {uploads.map((upload) => {
                        const id = pairId(upload);
                        const message = failures.get(id);
                        return (
                           <TableRow
                              key={id}
                              data-state={
                                 chosen.has(id) ? "selected" : undefined
                              }
                           >
                              <TableCell>
                                 <Checkbox
                                    checked={chosen.has(id)}
                                    disabled={busy}
                                    aria-label={`Select ${visibleText(upload.key)}`}
                                    onCheckedChange={() => toggle(upload)}
                                 />
                              </TableCell>
                              <TableCell className="break-all whitespace-normal">
                                 {visibleText(upload.key)}
                                 {message && (
                                    <span className="block text-xs text-viewertextred">
                                       {message}
                                    </span>
                                 )}
                              </TableCell>
                              <TableCell className="text-viewertext">
                                 {formatDate(upload.initiated)}
                              </TableCell>
                              <TableCell className="text-viewertext">
                                 {formatRelativeDay(upload.initiated)}
                              </TableCell>
                           </TableRow>
                        );
                     })}
                  </TableBody>
               </Table>
            </div>
         )}
         {hasNextPage && (
            <Button
               type="button"
               variant="outline"
               size="sm"
               className="w-fit shrink-0"
               disabled={busy || isFetchingNextPage}
               loading={isFetchingNextPage}
               onClick={() => void fetchNextPage()}
            >
               Load more
            </Button>
         )}
      </FormDialog>
   );
};

export default IncompleteUploadsModal;
