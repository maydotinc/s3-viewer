import type { ModalProps } from "@/lib/contexts/modal-props";
import { reviewNotice } from "@/components/Modals/batch-outcome";
import FailureList from "@/components/Modals/failure-list";
import DeletionProtectionNotice from "@/components/Modals/deletion-protection-notice";
import { KeyDialog } from "@/components/Modals/key-dialog";
import { findExisting } from "@/components/Modals/BulkRenameModal/plan";
import { useBulkOperation } from "@/components/Modals/useBulkOperation";
import { objectsPath } from "@/lib/api";
import useMoveObjects, {
   type MoveSummary,
   type MoveTarget,
} from "@/lib/hooks/mutations/object/useMoveObjects";
import useMovePrefix from "@/lib/hooks/mutations/object/useMovePrefix";
import { formatCount, visibleText } from "@/lib/utils/format";
import { batchProgressSentence, emptyBatchSummary } from "@/lib/utils/s3/batch";
import { destinationKey, validateDestination } from "@/lib/utils/s3/keys";
import { useRef, useState } from "react";

type MoveObjectsModalProps = ModalProps<"moveObjects">;

const MoveObjectsModal = ({
   onClose,
   userId,
   serverId,
   bucketName,
   source,
   onMoved,
   onMoveComplete,
}: MoveObjectsModalProps) => {
   const moveObjects = useMoveObjects();
   const movePrefix = useMovePrefix();
   const folder = "folderKey" in source ? source.folderKey : null;
   const files = "objects" in source ? source : null;
   const [checking, setChecking] = useState(false);
   const isPending = moveObjects.isPending || movePrefix.isPending || checking;
   const {
      error,
      setError,
      failed,
      listingError,
      remaining,
      completed: moved,
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
   } = useBulkOperation<MoveSummary["failed"][number]>({
      folder,
      isPending,
      pastTenseVerb: "moved",
      progressNotice: (count) =>
         `Moving everything under ${folder && visibleText(folder)}… ${count} objects so far.`,
   });
   const unsent = useRef<MoveTarget[]>([]);

   const validate = (value: string) => validateDestination(source, value);

   const settle = (result: MoveSummary, destination: string) =>
      accept(result, (complete) => {
         if (result.done > 0 || complete) onMoved?.();
         unsent.current = result.unsent;
         if (complete) {
            onMoveComplete?.(destination);
            onClose();
         }
      });

   const submit = (destination: string) => {
      if (isPending || stuck) return;
      const signal = start();
      if (folder) {
         movePrefix.mutate(
            {
               userId,
               serverId,
               bucketName,
               prefix: folder,
               newPrefix: destination,
               signal,
               onProgress,
            },
            { onSuccess: (result) => settle(result, destination), onError }
         );
         return;
      }
      const pending: MoveTarget[] =
         failed.length > 0
            ? retryable
            : (files?.objects ?? []).map(({ key, expectedETag }) => ({
                 key,
                 newKey: destinationKey(key, source, destination),
                 expectedETag,
              }));
      const send = (objects: MoveTarget[], gone: number) => {
         const onSuccess = (result: MoveSummary) =>
            settle(
               {
                  ...result,
                  done: result.done + gone,
                  failed: [...needsReview, ...result.failed],
               },
               destination
            );
         if (objects.length === 0) return onSuccess(emptyBatchSummary());
         moveObjects.mutate(
            { userId, serverId, bucketName, objects, signal },
            { onSuccess, onError }
         );
      };
      if (unsent.current.length === 0) return send(pending, 0);
      const unsentKeys = new Set(unsent.current.map(({ key }) => key));
      setChecking(true);
      void findExisting(
         objectsPath(serverId, bucketName),
         [...unsentKeys],
         signal
      )
         .then((alive) =>
            task.ifMounted(() => {
               if (signal.aborted) return;
               const left = new Set(alive);
               const objects = pending.filter(
                  ({ key }) => !unsentKeys.has(key) || left.has(key)
               );
               send(objects, pending.length - objects.length);
            })
         )
         .catch(onError)
         .finally(() => task.ifMounted(() => setChecking(false)));
   };

   const total = files?.objects.length ?? 0;
   const description = folder
      ? `Every object under ${visibleText(folder)} is copied to the new prefix and then removed from the old one. Large folders resume where they stopped.`
      : `${total === 1 ? "This object is" : `These ${formatCount(total)} objects are`} copied into the destination folder and then removed from here.`;

   const summary = attempted
      ? batchProgressSentence(
           `Moved ${formatCount(moved)}`,
           failed.length,
           remaining
        )
      : null;

   const notice =
      error ??
      [
         summary,
         listingError ??
            (needsReview.length > 0 ? reviewNotice("moving them") : null),
      ]
         .filter(Boolean)
         .join(" ");

   return (
      <KeyDialog
         onClose={onClose}
         userId={userId}
         serverId={serverId}
         bucketName={bucketName}
         title={folder ? "Rename folder" : "Move objects"}
         description={description}
         label={folder ? "Folder key" : "Destination folder"}
         submitLabel={
            attempted ? (folder ? "Continue moving" : "Retry") : "Move"
         }
         initialValue={folder ?? files?.prefix ?? ""}
         validate={validate}
         isPending={isPending}
         submitDisabled={stuck}
         inputDisabled={attempted}
         requestError={progressNotice ? null : notice || null}
         hint={progressNotice}
         onEdit={() => setError(null)}
         onSubmit={submit}
         height="sm"
      >
         <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
            <DeletionProtectionNotice serverId={serverId} action="move" />
            <FailureList failures={failed} />
         </div>
      </KeyDialog>
   );
};

export default MoveObjectsModal;
