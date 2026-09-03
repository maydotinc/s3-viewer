import {
   CenteredDialogHeader,
   ConfirmFooter,
} from "@/components/Modals/confirm-dialog";
import { errorMessage } from "@/lib/api";
import useDeleteObjects from "@/lib/hooks/mutations/object/useDeleteObjects";
import useDeletePrefix from "@/lib/hooks/mutations/object/useDeletePrefix";
import { baseName, isFolderKey, type S3DeleteResult } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { Dialog, DialogContent } from "@s3-viewer/ui/components/dialog";
import { Trash2 } from "lucide-react";
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
         onError: (err: unknown) => setError(errorMessage(err)),
      };
      const keys = failed.length > 0 ? failed.map((f) => f.key) : objectKeys;
      if (folder) deletePrefix.mutate({ bucketName, prefix: folder }, options);
      else deleteObjects.mutate({ bucketName, objectKeys: keys }, options);
   };

   return (
      <Dialog open onOpenChange={isPending ? undefined : onClose}>
         <DialogContent className="max-w-[95%] sm:max-w-md">
            <CenteredDialogHeader
               icon={Trash2}
               tone="destructive"
               title={title}
               descriptionClassName="break-all"
            >
               {description}
            </CenteredDialogHeader>
            <div
               className="min-h-5 text-center text-sm text-viewertextred"
               role="alert"
            >
               {error ??
                  (failed.length > 0 && (
                     <>
                        <p>
                           {failed.length === 1
                              ? "This object couldn't be deleted:"
                              : `${failed.length} objects couldn't be deleted:`}
                        </p>
                        <ul className="mt-1 max-h-32 overflow-y-auto break-all text-left text-viewertext">
                           {failed.map((f) => (
                              <li key={f.key}>
                                 <span className="font-medium text-viewerblack">
                                    {f.key}
                                 </span>{" "}
                                 — {f.message}
                              </li>
                           ))}
                        </ul>
                     </>
                  ))}
            </div>
            <ConfirmFooter cancelDisabled={isPending}>
               <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={confirm}
                  loading={isPending}
               >
                  {isPending
                     ? "Deleting…"
                     : failed.length > 0
                       ? "Retry"
                       : "Delete"}
               </Button>
            </ConfirmFooter>
         </DialogContent>
      </Dialog>
   );
};

export default ConfirmDeleteModal;
