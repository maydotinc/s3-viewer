import type { ModalProps } from "@/lib/contexts/modal-props";
import { reviewNotice } from "@/components/Modals/batch-outcome";
import { ConfirmDialog } from "@/components/Modals/confirm-dialog";
import FailureList from "@/components/Modals/failure-list";
import DeletionProtectionNotice from "@/components/Modals/deletion-protection-notice";
import { useBulkOperation } from "@/components/Modals/useBulkOperation";
import useServer from "@/components/use-server";
import useDeleteObjects, {
   type DeleteSummary,
} from "@/lib/hooks/mutations/object/useDeleteObjects";
import useDeletePrefix from "@/lib/hooks/mutations/object/useDeletePrefix";
import { formatCount } from "@/lib/utils/format";
import { batchProgressSentence } from "@/lib/utils/s3/batch";
import { Provider, isFolderKey, type S3DeleteTarget } from "@s3-viewer/types";

type ConfirmDeleteModalProps = ModalProps<"confirmDelete">;

const MAX_LISTED = 100;

// the full keys, so what gets deleted is confirmed by sight rather than by a file name in a sentence
const Targets = ({
   folder,
   objects,
}: {
   folder: string | null;
   objects: S3DeleteTarget[];
}) => {
   const keys = folder ? [folder] : objects.map((object) => object.key);
   const shown = keys.slice(0, MAX_LISTED);
   const hidden = keys.length - shown.length;
   return (
      <div className="flex flex-col gap-1.5 pb-1.5">
         <p className="text-xs font-medium text-viewertext">
            {folder
               ? "Folder"
               : keys.length === 1
                 ? "Object"
                 : `Objects · ${formatCount(keys.length)}`}
         </p>
         <ul className="max-h-40 overflow-y-auto rounded-lg border border-viewerborder bg-viewergray px-3 py-2 text-sm font-medium text-viewerblack [overflow-wrap:anywhere]">
            {shown.map((key) => (
               <li key={key} className="py-0.5">
                  {key}
               </li>
            ))}
            {hidden > 0 && (
               <li className="py-0.5 font-normal text-viewertext">
                  and {formatCount(hidden)} more
               </li>
            )}
         </ul>
      </div>
   );
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
   const isR2 = useServer(serverId)?.provider === Provider.R2;
   const folder =
      objects.length === 1 && objects[0] && isFolderKey(objects[0].key)
         ? objects[0].key
         : null;
   const total = objects.length;
   const isPending = deleteObjects.isPending || deletePrefix.isPending;
   const {
      error,
      failed,
      listingError,
      remaining,
      completed: deleted,
      retryable,
      needsReview,
      attempted,
      stuck,
      task,
      start,
      onProgress,
      onError,
      accept,
      progressNotice,
   } = useBulkOperation<DeleteSummary["failed"][number]>({
      folder,
      isPending,
      pastTenseVerb: "deleted",
      progressNotice: (count) =>
         `Removing current objects under ${folder}… ${count} deleted so far.`,
   });

   const title = folder
      ? "Delete folder"
      : total === 1
        ? "Delete object"
        : `Delete ${formatCount(total)} objects`;
   const permanence = isR2
      ? "R2 deletes are permanent."
      : "This may be permanent, depending on your bucket's versioning and retention settings.";
   const description = folder
      ? `This removes every current object under the folder. ${permanence}`
      : total === 1
        ? `This removes the object. ${permanence}`
        : `This removes ${formatCount(total)} current objects. ${permanence}`;

   const settle = (result: DeleteSummary) =>
      accept(result, (complete) => {
         if (result.done > 0) onDeleteSuccess?.();
         if (complete) onClose();
      });

   const confirm = () => {
      if (isPending || stuck) return;
      const signal = start();
      if (folder) {
         deletePrefix.mutate(
            {
               userId,
               serverId,
               bucketName,
               prefix: folder,
               signal,
               onProgress,
            },
            { onSuccess: settle, onError }
         );
         return;
      }
      deleteObjects.mutate(
         {
            userId,
            serverId,
            bucketName,
            objects: failed.length > 0 ? retryable : objects,
            signal,
         },
         {
            onSuccess: (result: DeleteSummary) =>
               settle({
                  ...result,
                  failed: [...needsReview, ...result.failed],
               }),
            onError,
         }
      );
   };

   const failureSummary =
      failed.length === 0
         ? null
         : failed.length === 1
           ? "This object couldn't be deleted:"
           : `${formatCount(failed.length)} objects couldn't be deleted:`;
   const folderSummary =
      folder && attempted
         ? batchProgressSentence(
              `Deleted ${formatCount(deleted)} of this folder`,
              failed.length,
              remaining
           )
         : null;

   const detail =
      listingError ??
      (needsReview.length > 0
         ? reviewNotice("deleting them again")
         : failureSummary);
   const notice = [folderSummary, detail].filter(Boolean).join(" ");

   return (
      <ConfirmDialog
         closable={!isPending}
         onClose={onClose}
         title={title}
         description={description}
         error={progressNotice ? null : (error ?? (notice || null))}
         hint={progressNotice}
         confirmDisabled={stuck}
         confirmVariant="destructive"
         confirmLabel={
            folder && attempted
               ? "Continue deleting"
               : failed.length > 0
                 ? "Retry"
                 : "Delete"
         }
         isPending={isPending}
         onConfirm={confirm}
         onAbort={() => task.cancel()}
      >
         <Targets folder={folder} objects={objects} />
         <DeletionProtectionNotice serverId={serverId} action="delete" />
         <FailureList failures={failed} />
      </ConfirmDialog>
   );
};

export default ConfirmDeleteModal;
