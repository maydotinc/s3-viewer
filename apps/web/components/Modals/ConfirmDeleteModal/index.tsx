import { ConfirmDialog } from "@/components/Modals/confirm-dialog";
import { errorMessage } from "@/lib/api";
import useDeleteObjects from "@/lib/hooks/mutations/object/useDeleteObjects";
import useDeletePrefix from "@/lib/hooks/mutations/object/useDeletePrefix";
import { baseName, isFolderKey, type S3DeleteResult } from "@s3-viewer/types";
import { useState } from "react";

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
   const [failed, setFailed] = useState<S3DeleteResult["failed"]>([]);

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
      ? `This deletes every object under ${folder}. This can't be undone.`
      : count === 1
        ? `This deletes ${baseName(objectKeys[0] ?? "")}. This can't be undone.`
        : `This deletes ${count} objects. This can't be undone.`;

   const confirm = () => {
      setError(null);
      const options = {
         onSuccess: (result: S3DeleteResult) => {
            if (result.deleted.length > 0) onDeleteSuccess?.();
            setFailed(result.failed);
            if (result.failed.length === 0) onClose();
         },
         onError: (err: unknown) => {
            setFailed([]);
            setError(errorMessage(err));
         },
      };
      const keys = failed.length > 0 ? failed.map((f) => f.key) : objectKeys;
      if (folder) deletePrefix.mutate({ bucketName, prefix: folder }, options);
      else deleteObjects.mutate({ bucketName, objectKeys: keys }, options);
   };

   const failureSummary =
      failed.length === 0
         ? null
         : failed.length === 1
           ? "This object couldn't be deleted:"
           : `${failed.length} objects couldn't be deleted:`;

   return (
      <ConfirmDialog
         closable={!isPending}
         onClose={onClose}
         title={title}
         description={description}
         descriptionClassName="break-all"
         error={error ?? failureSummary}
         confirmVariant="destructive"
         confirmLabel={failed.length > 0 ? "Retry" : "Delete"}
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
            </ul>
         )}
      </ConfirmDialog>
   );
};

export default ConfirmDeleteModal;
