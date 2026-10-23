import type { ModalProps } from "@/lib/contexts/modal-props";
import { KeyDialog } from "@/components/Modals/key-dialog";
import DeletionProtectionNotice from "@/components/Modals/deletion-protection-notice";
import useRequestError from "@/components/Modals/useRequestError";
import useRenameObject from "@/lib/hooks/mutations/object/useRenameObject";
import { validateObjectKey } from "@/lib/utils/s3/keys";
import { toast } from "@s3-viewer/ui/components/toast";

type RenameObjectModalProps = ModalProps<"renameObject">;

const RenameObjectModal = ({
   onClose,
   userId,
   serverId,
   bucketName,
   objectKey,
   expectedETag,
   onRenameSuccess,
}: RenameObjectModalProps) => {
   const rename = useRenameObject();
   const request = useRequestError();

   const validate = (value: string) =>
      value === objectKey
         ? "That's the current name."
         : validateObjectKey(value);

   return (
      <KeyDialog
         onClose={onClose}
         userId={userId}
         serverId={serverId}
         bucketName={bucketName}
         title="Rename object"
         description="Edit the full key to move or rename this object. S3 has no native rename, so this copies the object to the new key and then deletes the original."
         label="Object key"
         submitLabel="Rename"
         initialValue={objectKey}
         validate={validate}
         isPending={rename.isPending}
         requestError={request.error}
         onEdit={request.clear}
         onSubmit={(newObjectKey) =>
            rename.mutate(
               {
                  userId,
                  serverId,
                  bucketName,
                  objectKey,
                  newObjectKey,
                  expectedETag,
               },
               request.attempt(() => {
                  toast.success("Object renamed.");
                  onRenameSuccess?.(newObjectKey);
                  onClose();
               })
            )
         }
      >
         <DeletionProtectionNotice serverId={serverId} action="rename" />
      </KeyDialog>
   );
};

export default RenameObjectModal;
