import type { ModalProps } from "@/lib/contexts/modal-props";
import { FormDialog } from "@/components/Modals/form-dialog";
import { NameField, useNameField } from "@/components/Modals/name-field";
import { errorMessage } from "@/lib/api";
import useCreateFolder from "@/lib/hooks/mutations/object/useCreateFolder";
import useBucketScope from "@/lib/hooks/queries/s3/useBucketScope";
import { writeScopeError } from "@/lib/utils/folder-access";
import { validateFolderName, validateFolderKey } from "@/lib/utils/s3/keys";
import { toast } from "@s3-viewer/ui/components/toast";
import type { FormEvent } from "react";

type CreateFolderModalProps = ModalProps<"createFolder">;

const CreateFolderModal = ({
   onClose,
   userId,
   serverId,
   bucketName,
   prefix,
   onCreateSuccess,
}: CreateFolderModalProps) => {
   const createFolder = useCreateFolder();
   const scope = useBucketScope(userId, serverId, bucketName);
   const field = useNameField(
      (name) =>
         validateFolderName(name) ??
         validateFolderKey(`${prefix}${name}/`) ??
         writeScopeError(scope, `${prefix}${name}/`)
   );

   const submit = (event: FormEvent) => {
      event.preventDefault();
      if (createFolder.isPending || !field.valid) return;
      field.setRequestError(null);
      const folderKey = `${prefix}${field.trimmed}/`;
      createFolder.mutate(
         { userId, serverId, bucketName, folderKey },
         {
            onSuccess: () => {
               toast.success("Folder created.");
               onCreateSuccess?.(folderKey);
               onClose();
            },
            onError: (failure) => field.setRequestError(errorMessage(failure)),
         }
      );
   };

   return (
      <FormDialog
         onClose={onClose}
         isPending={createFolder.isPending}
         title="New folder"
         description={`This writes an empty marker object at ${prefix || bucketName + "/"} so the folder shows up before anything is uploaded to it.`}
         onSubmit={submit}
         submitLabel="Create folder"
         submitDisabled={!field.valid}
      >
         <NameField field={field} label="Folder name" placeholder="invoices" />
      </FormDialog>
   );
};

export default CreateFolderModal;
