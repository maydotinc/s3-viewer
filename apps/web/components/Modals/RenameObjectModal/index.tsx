import type { ModalProps } from "@/lib/contexts/modal-props";
import { KeyDialog } from "@/components/Modals/key-dialog";
import DeletionProtectionNotice from "@/components/Modals/deletion-protection-notice";
import { errorMessage } from "@/lib/api";
import useRenameObject from "@/lib/hooks/mutations/object/useRenameObject";
import { validateObjectKey } from "@/lib/utils/s3/keys";
import { toast } from "@s3-viewer/ui/components/toast";
import { useState } from "react";

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
   const [requestError, setRequestError] = useState<string | null>(null);

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
         requestError={requestError}
         onEdit={() => setRequestError(null)}
         onSubmit={(newObjectKey) => {
            setRequestError(null);
            rename.mutate(
               {
                  userId,
                  serverId,
                  bucketName,
                  objectKey,
                  newObjectKey,
                  expectedETag,
               },
               {
                  onSuccess: () => {
                     toast.success("Object renamed.");
                     onRenameSuccess?.(newObjectKey);
                     onClose();
                  },
                  onError: (failure) => setRequestError(errorMessage(failure)),
               }
            );
         }}
      >
         <DeletionProtectionNotice serverId={serverId} action="rename" />
      </KeyDialog>
   );
};

export default RenameObjectModal;
