import { ConfirmDialog } from "@/components/Modals/confirm-dialog";
import { errorMessage, isAborted } from "@/lib/api";
import useDeleteObjects, {
   type DeleteSummary,
} from "@/lib/hooks/mutations/object/useDeleteObjects";
import useDeletePrefix from "@/lib/hooks/mutations/object/useDeletePrefix";
import useServers from "@/lib/hooks/queries/server/useServers";
import {
   Provider,
   baseName,
   isFolderKey,
   type S3DeleteTarget,
} from "@s3-viewer/types";
import { useEffect, useRef, useState } from "react";

type ConfirmDeleteModalProps = {
   onClose: () => void;
   userId: string;
   serverId: string;
   bucketName: string;
   objects: S3DeleteTarget[];
   onDeleteSuccess?: () => void;
};

const ConfirmDeleteModal = ({
   onClose,
   userId,
   serverId,
   bucketName,
   objects,
   onDeleteSuccess,
}: ConfirmDeleteModalProps) => {
   const deleteObjects = useDeleteObjects();
   const deletePrefix = useDeletePrefix();
   const { servers } = useServers();
   const isR2 =
      servers.find((server) => server.id === serverId)?.provider ===
      Provider.R2;
   const [error, setError] = useState<string | null>(null);
   const [failed, setFailed] = useState<DeleteSummary["failed"]>([]);
   const [failedTotal, setFailedTotal] = useState(0);
   const [listingError, setListingError] = useState<string | null>(null);
   const [progress, setProgress] = useState(0);
   const abort = useRef<AbortController | null>(null);
   const mounted = useRef(true);

   useEffect(() => {
      mounted.current = true;
      return () => {
         mounted.current = false;
         abort.current?.abort();
      };
   }, []);

   const folder =
      objects.length === 1 && objects[0] && isFolderKey(objects[0].key)
         ? objects[0].key
         : null;
   const count = objects.length;
   const isPending = deleteObjects.isPending || deletePrefix.isPending;
   const retryable = failed.filter((failure) => failure.retryable);
   const needsReview = failed.filter((failure) => !failure.retryable);

   const title = folder
      ? "Delete folder"
      : count === 1
        ? "Delete object"
        : `Delete ${count} objects`;
   const permanence = isR2
      ? "R2 deletes are permanent. Pause other writers: a file changed during deletion could also be removed."
      : "This may be permanent, depending on your bucket’s versioning and retention settings.";
   const description = folder
      ? isPending && progress > 0
         ? `Removing current objects under ${folder}… ${progress} deleted so far.`
         : `This removes current objects under ${folder}. ${permanence}`
      : count === 1
        ? `This removes ${baseName(objects[0]?.key ?? "")}. ${permanence}`
        : `This removes ${count} current objects. ${permanence}`;

   const confirm = () => {
      if (
         isPending ||
         ((failed.length > 0 || listingError) && retryable.length === 0)
      )
         return;
      setError(null);
      const options = {
         onSuccess: (result: DeleteSummary) => {
            if (!mounted.current) return;
            if (result.deleted > 0) onDeleteSuccess?.();
            const remaining = [...needsReview, ...result.failed];
            setFailed(remaining);
            setFailedTotal(remaining.length);
            setListingError(listingError ?? result.listingError);
            if (remaining.length === 0 && !listingError && !result.listingError)
               onClose();
         },
         onError: (err: unknown) => {
            if (isAborted(err) || !mounted.current) return;
            setError(errorMessage(err));
         },
      };
      if (folder && failed.length === 0 && !listingError) {
         abort.current = new AbortController();
         setProgress(0);
         deletePrefix.mutate(
            {
               userId,
               serverId,
               bucketName,
               prefix: folder,
               signal: abort.current.signal,
               onProgress: (deleted: number) => {
                  if (mounted.current) setProgress(deleted);
               },
            },
            options
         );
         return;
      }
      const targets = failed.length > 0 ? retryable : objects;
      abort.current = new AbortController();
      deleteObjects.mutate(
         {
            userId,
            serverId,
            bucketName,
            objects: targets,
            signal: abort.current.signal,
         },
         options
      );
   };

   const failureSummary =
      failedTotal === 0
         ? null
         : failedTotal === 1
           ? "This object couldn't be deleted:"
           : `${failedTotal} objects couldn't be deleted:`;

   const displayedFailures = failed.slice(0, 100);

   return (
      <ConfirmDialog
         closable={!isPending}
         onClose={onClose}
         title={title}
         description={description}
         descriptionClassName="break-all"
         error={
            error ??
            listingError ??
            (needsReview.length > 0
               ? "Some objects need to be reviewed again. Close this dialog and refresh before deleting them again."
               : failureSummary)
         }
         confirmDisabled={
            (failed.length > 0 || Boolean(listingError)) &&
            retryable.length === 0
         }
         confirmVariant="destructive"
         confirmLabel={failedTotal > 0 ? "Retry" : "Delete"}
         isPending={isPending}
         onConfirm={confirm}
      >
         {failed.length > 0 && (
            <ul className="max-h-40 overflow-y-auto rounded-md border border-viewerborder bg-viewergray p-2 text-xs break-all text-viewertext">
               {displayedFailures.map((f) => (
                  <li key={f.key}>
                     <span className="font-medium text-viewerblack">
                        {f.key}
                     </span>{" "}
                     — {f.message}
                  </li>
               ))}
               {failedTotal > displayedFailures.length && (
                  <li>and {failedTotal - displayedFailures.length} more</li>
               )}
            </ul>
         )}
      </ConfirmDialog>
   );
};

export default ConfirmDeleteModal;
