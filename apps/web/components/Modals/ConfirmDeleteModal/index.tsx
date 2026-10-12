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
import { Provider, baseName, isFolderKey } from "@s3-viewer/types";

type ConfirmDeleteModalProps = ModalProps<"confirmDelete">;

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
      ? `This removes current objects under ${folder}. ${permanence}`
      : total === 1
        ? `This removes ${baseName(objects[0]?.key ?? "")}. ${permanence}`
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
         reserveErrorSpace
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
         <DeletionProtectionNotice serverId={serverId} action="delete" />
         <FailureList failures={failed} />
      </ConfirmDialog>
   );
};

export default ConfirmDeleteModal;
