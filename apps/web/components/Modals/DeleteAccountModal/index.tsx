import { ConfirmDialog } from "@/components/Modals/confirm-dialog";
import { authClient, signOut } from "@/lib/auth";
import { GENERIC_ERROR_MESSAGE } from "@s3-viewer/types";
import { useState } from "react";

type DeleteAccountModalProps = { onClose: () => void };

const DeleteAccountModal = ({ onClose }: DeleteAccountModalProps) => {
   const [error, setError] = useState<string | null>(null);
   const [deleting, setDeleting] = useState(false);

   const confirm = async () => {
      if (deleting) return;
      setDeleting(true);
      setError(null);
      const { error: deleteError } = await authClient.deleteUser({});
      if (deleteError) {
         setError(deleteError.message ?? GENERIC_ERROR_MESSAGE);
         setDeleting(false);
         return;
      }
      await signOut();
   };

   return (
      <ConfirmDialog
         closable={!deleting}
         onClose={onClose}
         title="Delete your account?"
         description="This removes your account, your sessions and every server connection you own, including your members' access. Buckets and files in your storage are not touched. This can't be undone."
         error={error}
         confirmVariant="destructive"
         confirmLabel="Delete account"
         pendingLabel="Deleting…"
         isPending={deleting}
         onConfirm={() => void confirm()}
      />
   );
};

export default DeleteAccountModal;
