import { useModalContext } from "@/lib/contexts/ModalContext";
import ConfirmDeleteModal from "./ConfirmDeleteModal";
import ConnectModal from "./ConnectModal";
import CreateBucketModal from "./CreateBucketModal";
import DisconnectModal from "./DisconnectModal";
import RenameModal from "./RenameModal";
import RenameObjectModal from "./RenameObjectModal";
import ShareModal from "./ShareModal";
import UpdateCredentialsModal from "./UpdateCredentialsModal";

const ModalManager = () => {
   const { modals, closeModal } = useModalContext();
   return (
      <>
         {modals.connect && (
            <ConnectModal onClose={() => closeModal("connect")} />
         )}
         {modals.createBucket && (
            <CreateBucketModal
               {...modals.createBucket}
               onClose={() => closeModal("createBucket")}
            />
         )}
         {modals.confirmDelete && (
            <ConfirmDeleteModal
               {...modals.confirmDelete}
               onClose={() => closeModal("confirmDelete")}
            />
         )}
         {modals.rename && (
            <RenameModal
               {...modals.rename}
               onClose={() => closeModal("rename")}
            />
         )}
         {modals.renameObject && (
            <RenameObjectModal
               {...modals.renameObject}
               onClose={() => closeModal("renameObject")}
            />
         )}
         {modals.disconnect && (
            <DisconnectModal
               {...modals.disconnect}
               onClose={() => closeModal("disconnect")}
            />
         )}
         {modals.share && (
            <ShareModal {...modals.share} onClose={() => closeModal("share")} />
         )}
         {modals.updateCredentials && (
            <UpdateCredentialsModal
               {...modals.updateCredentials}
               onClose={() => closeModal("updateCredentials")}
            />
         )}
      </>
   );
};

export default ModalManager;
