import { useModalContext } from "@/lib/contexts/ModalContext";
import AuthModal from "./AuthModal";
import ConnectModal from "./ConnectModal";
import DisconnectModal from "./DisonnectModal";
import RenameModal from "./RenameModal";

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
               case "disconnect":
                  return (
                     <DisconnectModal
                        key={`disconnect-${index}`}
                        {...modal.props}
                        onClose={() => closeModal("disconnect")}
                     />
                  );
               //    case "delete":
               //       return (
               //          <DeleteModal
               //             key={`delete-${index}`}
               //             {...modal.props}
               //             onClose={() => closeModal("delete")}
               //          />
               //       );
               default:
                  return null;
            }
         })}
      </>
   );
};

export default ModalManager;
