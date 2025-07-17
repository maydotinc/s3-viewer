import { useModalContext } from "@/lib/contexts/ModalContext";
import AuthModal from "./AuthModal";
import ConfirmDeleteModal from "./ConfirmDeleteModal";
import ConnectModal from "./ConnectModal";
import CreateBucketModal from "./CreateBucketModal";
import DisconnectModal from "./DisonnectModal";
import InvitesModal from "./InvitesModal";
import RenameModal from "./RenameModal";
import ShareModal from "./ShareModal";

const ModalManager = () => {
   const { modals, closeModal } = useModalContext();
   return (
      <>
         {modals.map((modal, index) => {
            switch (modal.type) {
               case "auth":
                  return (
                     <AuthModal
                        key={`auth-${index}`}
                        {...modal.props}
                        onClose={() => closeModal("auth")}
                     />
                  );
               case "connect":
                  return (
                     <ConnectModal
                        key={`connect-${index}`}
                        {...modal.props}
                        onClose={() => closeModal("connect")}
                     />
                  );

               case "rename":
                  return (
                     <RenameModal
                        key={`rename-${index}`}
                        {...modal.props}
                        onClose={() => closeModal("rename")}
                     />
                  );
               case "confirmDelete":
                  return (
                     <ConfirmDeleteModal
                        key={`confirmDelete-${index}`}
                        {...modal.props}
                        onClose={() => closeModal("confirmDelete")}
                     />
                  );
               case "disconnect":
                  return (
                     <DisconnectModal
                        key={`disconnect-${index}`}
                        {...modal.props}
                        onClose={() => closeModal("disconnect")}
                     />
                  );
               case "share":
                  return (
                     <ShareModal
                        key={`share-${index}`}
                        {...modal.props}
                        onClose={() => closeModal("share")}
                     />
                  );
               case "invites":
                  return (
                     <InvitesModal
                        key={`invites-${index}`}
                        {...modal.props}
                        onClose={() => closeModal("invites")}
                     />
                  );
               case "createBucket":
                  return (
                     <CreateBucketModal
                        key={`createBucket-${index}`}
                        {...modal.props}
                        onClose={() => closeModal("createBucket")}
                     />
                  );
               default:
                  return null;
            }
         })}
      </>
   );
};

export default ModalManager;
