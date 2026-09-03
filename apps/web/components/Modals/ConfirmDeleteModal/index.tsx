import { ConfirmDialog } from "@/components/Modals/confirm-dialog";
import { errorMessage, isAborted } from "@/lib/api";
import useDeleteObjects, {
   type DeleteSummary,
} from "@/lib/hooks/mutations/object/useDeleteObjects";
import useDeletePrefix from "@/lib/hooks/mutations/object/useDeletePrefix";
import { baseName, isFolderKey } from "@s3-viewer/types";
import { useEffect, useRef, useState } from "react";

type ConfirmDeleteModalProps = {
   onClose: () => void;
   serverId: string;
   bucketName: string;
   objectKeys: string[];
   onDeleteSuccess?: () => void;
};

const ConfirmDeleteModal = ({
   onClose,
   bucketName,
   objectKeys,
   onDeleteSuccess,
}: ConfirmDeleteModalProps) => {
   const deleteObjects = useDeleteObjects();
   const deletePrefix = useDeletePrefix();
   const [error, setError] = useState<string | null>(null);
   const [failed, setFailed] = useState<DeleteSummary["failed"]>([]);
   const [failedTotal, setFailedTotal] = useState(0);
   const [progress, setProgress] = useState(0);
   const abort = useRef<AbortController | null>(null);

   useEffect(() => () => abort.current?.abort(), []);

   const folder =
      objectKeys.length === 1 && objectKeys[0] && isFolderKey(objectKeys[0])
         ? objectKeys[0]
         : null;
   const count = objectKeys.length;
   const isPending = deleteObjects.isPending || deletePrefix.isPending;

   const title = folder
      ? "Delete folder"
      : count === 1
        ? "Delete object"
        : `Delete ${count} objects`;
   const description = folder
      ? isPending && progress > 0
         ? `Deleting every object under ${folder}… ${progress} deleted so far.`
         : `This deletes every object under ${folder}. This can't be undone.`
      : count === 1
        ? `This deletes ${baseName(objectKeys[0] ?? "")}. This can't be undone.`
        : `This deletes ${count} objects. This can't be undone.`;

   const confirm = () => {
      setError(null);
      const options = {
         onSuccess: (result: DeleteSummary) => {
            if (result.deleted > 0) onDeleteSuccess?.();
            setFailed(result.failed);
            setFailedTotal(result.failedTotal);
            if (result.failedTotal === 0) onClose();
         },
         onError: (err: unknown) => {
            if (isAborted(err)) return;
            setFailed([]);
            setFailedTotal(0);
            setError(errorMessage(err));
         },
      };
      if (folder) {
         abort.current = new AbortController();
         setProgress(0);
         deletePrefix.mutate(
            {
               bucketName,
               prefix: folder,
               signal: abort.current.signal,
               onProgress: setProgress,
            },
            options
         );
         return;
      }
      const keys = failed.length > 0 ? failed.map((f) => f.key) : objectKeys;
      deleteObjects.mutate({ bucketName, objectKeys: keys }, options);
   };

   const failureSummary =
      failedTotal === 0
         ? null
         : failedTotal === 1
           ? "This object couldn't be deleted:"
           : `${failedTotal} objects couldn't be deleted:`;

   return (
      <ConfirmDialog
         closable={!isPending}
         onClose={onClose}
         title={title}
         description={description}
         descriptionClassName="break-all"
         error={error ?? failureSummary}
         confirmVariant="destructive"
         confirmLabel={failedTotal > 0 ? "Retry" : "Delete"}
         isPending={isPending}
         onConfirm={confirm}
      >
         {failed.length > 0 && (
            <ul className="max-h-40 overflow-y-auto rounded-md border border-viewerborder bg-viewergray p-2 text-xs break-all text-viewertext">
               {failed.map((f) => (
                  <li key={f.key}>
                     <span className="font-medium text-viewerblack">
                        {f.key}
                     </span>{" "}
                     — {f.message}
                  </li>
               ))}
               {failedTotal > failed.length && (
                  <li>and {failedTotal - failed.length} more</li>
               )}
            </ul>
         )}
      </ConfirmDialog>
   );
};

export default ConfirmDeleteModal;
