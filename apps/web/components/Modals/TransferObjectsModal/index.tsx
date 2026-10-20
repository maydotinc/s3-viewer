import Field from "@/components/form-field";
import { reviewNotice } from "@/components/Modals/batch-outcome";
import FailureList from "@/components/Modals/failure-list";
import { FormDialog } from "@/components/Modals/form-dialog";
import { PathField } from "@/components/Modals/key-dialog";
import ServerListPagination from "@/components/server-list-pagination";
import useServer from "@/components/use-server";
import type { ModalProps } from "@/lib/contexts/modal-props";
import { errorMessage, isAborted } from "@/lib/api";
import { useAbortableTask } from "@/lib/hooks/useAbortableTask";
import { useBeforeUnload } from "@/lib/hooks/useBeforeUnload";
import { objectPermissions } from "@/lib/hooks/usePermission";
import useTransferObjects, {
   createTransferOperation,
   folderTransferOverlaps,
   transferSummary,
   type TransferOperation,
   type TransferProgress,
   type TransferSummary,
} from "@/lib/hooks/mutations/object/useTransferObjects";
import useBucketsForServer from "@/lib/hooks/queries/s3/useBucketsForServer";
import useServers from "@/lib/hooks/queries/server/useServers";
import { usePathSuggestion } from "@/lib/hooks/usePathSuggestion";
import { useUserId } from "@/lib/stores/session-store";
import { reachOf, writeScopeError } from "@/lib/utils/folder-access";
import { batchProgressSentence, isBatchComplete } from "@/lib/utils/s3/batch";
import { destinationKey, validateDestination } from "@/lib/utils/s3/keys";
import {
   formatBytes,
   formatCount,
   joinSentences,
   visibleText,
} from "@/lib/utils/format";
import { effectiveBucketRole } from "@s3-viewer/permissions";
import type { S3Bucket, ServerInfo } from "@s3-viewer/types";
import { Checkbox } from "@s3-viewer/ui/components/checkbox";
import { Label } from "@s3-viewer/ui/components/label";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@s3-viewer/ui/components/select";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import useTransferPreflight from "./useTransferPreflight";

type TransferObjectsModalProps = ModalProps<"transferObjects">;

const CANCELLED =
   "Cancelled. Continue to copy unfinished objects; interrupted copies need review at the destination.";
const NO_WRITABLE_BUCKET = "You can't add files to any bucket on this server.";

const writableBuckets = (
   server: ServerInfo | undefined,
   buckets: readonly S3Bucket[]
): S3Bucket[] =>
   server
      ? buckets.filter(
           (bucket) =>
              objectPermissions(
                 effectiveBucketRole(server.userRole, bucket.userRole),
                 server.capabilities
              ).upload
        )
      : [];

const TransferObjectsModal = ({
   onClose,
   userId,
   serverId,
   bucketName,
   source,
   onTransferred,
}: TransferObjectsModalProps) => {
   const transfer = useTransferObjects();
   const { servers } = useServers();
   const folder = "folderKey" in source ? source.folderKey : null;
   const files = "objects" in source ? source : null;
   const inputId = useId();
   const errorId = useId();
   const replaceId = useId();

   const [destServerId, setDestServerId] = useState(serverId);
   const [destBucket, setDestBucket] = useState(bucketName);
   const [prefix, setPrefix] = useState(folder ?? files?.prefix ?? "");
   const [overwrite, setOverwrite] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [summary, setSummary] = useState<TransferSummary | null>(null);
   const [progress, setProgress] = useState<TransferProgress>({
      done: 0,
      skipped: 0,
      bytes: 0,
   });
   const task = useAbortableTask();
   const operation = useRef<TransferOperation | null>(null);
   const [started, setStarted] = useState(false);

   const {
      buckets,
      isLoading: isBucketsLoading,
      error: bucketsError,
   } = useBucketsForServer(useUserId(), destServerId);

   useBeforeUnload(transfer.isPending);

   const destServer = useServer(destServerId);

   useEffect(() => {
      if (started || isBucketsLoading) return;
      const names = writableBuckets(destServer, buckets).map(
         (bucket) => bucket.name
      );
      setDestBucket((current) =>
         names.includes(current) ? current : (names[0] ?? "")
      );
   }, [buckets, destServer, isBucketsLoading, started]);

   const writable = writableBuckets(destServer, buckets);
   const chosen = writable.find((bucket) => bucket.name === destBucket);
   const sameBucket = destServerId === serverId && destBucket === bucketName;
   const destReach = isBucketsLoading ? undefined : reachOf(chosen);
   const pathValidation =
      !started && !isBucketsLoading && writable.length === 0
         ? NO_WRITABLE_BUCKET
         : validateDestination(source, prefix, {
              sameBucket,
              overlaps: () =>
                 folderTransferOverlaps({
                    serverId,
                    bucketName,
                    source,
                    destination: {
                       serverId: destServerId,
                       bucketName: destBucket,
                       prefix,
                    },
                 }),
           });
   const validation = pathValidation ?? writeScopeError(destReach, prefix);

   const needsReview =
      summary?.failed.some((failure) => !failure.retryable) ?? false;
   const stuck = started && summary !== null && !summary.remaining;
   const blocked = stuck || validation !== null || (!started && !chosen);

   const destinationKeys = (files?.objects ?? []).map((item) =>
      destinationKey(item.key, source, prefix)
   );
   const preflight = useTransferPreflight(
      destServerId,
      destBucket,
      destinationKeys,
      Boolean(files) && !blocked && !started && !transfer.isPending
   );

   const suggestion = usePathSuggestion(destBucket, prefix, {
      scope: { userId, serverId: destServerId },
   });

   const submit = (event: FormEvent) => {
      event.preventDefault();
      if (transfer.isPending || blocked) return;
      setError(null);
      setStarted(true);
      const signal = task.start();
      const input = {
         userId,
         serverId,
         bucketName,
         source,
         destination: {
            serverId: destServerId,
            bucketName: destBucket,
            prefix,
         },
         overwrite,
         signal,
         onProgress: (next: TransferProgress) => {
            task.ifMounted(() => setProgress(next));
         },
      };
      operation.current ??= createTransferOperation(input);
      const currentOperation = operation.current;
      const transferredBefore = currentOperation.summary.transferred;
      transfer.mutate(
         { ...input, operation: currentOperation },
         {
            onSuccess: (result) =>
               task.ifMounted(() => {
                  setSummary(result);
                  if (result.transferred > transferredBefore) onTransferred?.();
                  if (isBatchComplete(result)) onClose();
               }),
            onError: (failure) =>
               task.ifMounted(() => {
                  if (!isAborted(failure)) {
                     setError(errorMessage(failure));
                     return;
                  }
                  setError(CANCELLED);
                  setSummary(transferSummary(currentOperation));
                  if (currentOperation.summary.transferred > transferredBefore)
                     onTransferred?.();
               }),
         }
      );
   };

   const total = files?.objects.length ?? 0;
   const description = folder
      ? `Every object under ${visibleText(folder)} is copied to the destination. The originals stay where they are.`
      : `${total === 1 ? "This object is" : `These ${formatCount(total)} objects are`} copied to the destination. The originals stay where they are.`;

   const status = transfer.isPending
      ? `Copied ${formatCount(progress.done)}${folder ? "" : ` of ${formatCount(total)}`}${progress.bytes > 0 ? ` (${formatBytes(progress.bytes)})` : ""}…`
      : summary
        ? batchProgressSentence(
             `Copied ${formatCount(summary.transferred)}`,
             summary.failed.length,
             summary.remaining,
             summary.skipped > 0
                ? `${formatCount(summary.skipped)} already there`
                : null
          )
        : null;

   const hint = files
      ? preflight.isChecking
         ? "Checking the destination…"
         : preflight.isReady
           ? preflight.existing === 0
              ? "Nothing there uses these names yet."
              : `${formatCount(preflight.existing)} of ${formatCount(preflight.total)} already exist there${overwrite ? " and will be replaced." : " and will be skipped."}`
           : undefined
      : undefined;

   const notice = joinSentences(
      error,
      status,
      summary?.listingError,
      needsReview ? reviewNotice("copying them again") : null,
      bucketsError ? errorMessage(bucketsError) : null
   );

   return (
      <FormDialog
         onClose={onClose}
         isPending={transfer.isPending}
         title={
            folder ? "Copy folder to another bucket" : "Copy to another bucket"
         }
         description={description}
         onSubmit={submit}
         submitLabel={started ? "Continue copying" : "Copy"}
         onAbort={() => task.cancel()}
         submitDisabled={blocked}
         bodyClassName="flex flex-col gap-4"
      >
         <Field label="Destination server" htmlFor={`${inputId}-server`}>
            <Select
               value={destServerId}
               disabled={transfer.isPending || started}
               onValueChange={(next) => {
                  setError(null);
                  setDestServerId(next);
               }}
            >
               <SelectTrigger
                  id={`${inputId}-server`}
                  aria-label="Destination server"
               >
                  <SelectValue placeholder="Pick a server" />
               </SelectTrigger>
               <SelectContent>
                  {servers.map((server) => (
                     <SelectItem key={server.id} value={server.id}>
                        {server.name}
                     </SelectItem>
                  ))}
               </SelectContent>
            </Select>
            <div className="min-w-0 empty:hidden">
               <ServerListPagination />
            </div>
         </Field>
         <Field label="Destination bucket" htmlFor={`${inputId}-bucket`}>
            <Select
               value={destBucket}
               disabled={transfer.isPending || started || isBucketsLoading}
               onValueChange={(next) => {
                  setError(null);
                  setDestBucket(next);
               }}
            >
               <SelectTrigger
                  id={`${inputId}-bucket`}
                  aria-label="Destination bucket"
               >
                  <SelectValue
                     placeholder={
                        isBucketsLoading ? "Loading buckets…" : "Pick a bucket"
                     }
                  />
               </SelectTrigger>
               <SelectContent>
                  {writable.map((bucket) => (
                     <SelectItem key={bucket.name} value={bucket.name}>
                        {bucket.name}
                     </SelectItem>
                  ))}
               </SelectContent>
            </Select>
         </Field>
         <div className="flex flex-col gap-1.5">
            <PathField
               id={inputId}
               errorId={errorId}
               label="Destination folder"
               invalid={validation !== null}
               hint={hint}
               value={prefix}
               suggestionBase={prefix}
               suggestion={suggestion}
               placeholder="reports/"
               disabled={transfer.isPending || started}
               onChange={(event) => {
                  setError(null);
                  setPrefix(event.target.value);
               }}
               onAccept={setPrefix}
            >
               {notice || validation}
            </PathField>
         </div>
         <div className="flex items-center gap-2">
            <Checkbox
               id={replaceId}
               checked={overwrite}
               disabled={transfer.isPending || started}
               onCheckedChange={(next) => setOverwrite(next === true)}
            />
            <Label htmlFor={replaceId} className="font-normal">
               Replace objects that already exist there
            </Label>
         </div>
         <FailureList failures={summary?.failed ?? []} />
      </FormDialog>
   );
};

export default TransferObjectsModal;
