import { useModalContext } from "@/lib/contexts/ModalContext";
import AuthModal from "./AuthModal";

const ModalManager = () => {
   const { modals, closeModal } = useModalContext();
   return (
      <>
         {modals.map((modal, index) => {
            switch (modal) {
               case "auth":
                  return <AuthModal key={`auth-${index}`} onClose={() => closeModal("auth")} />;
               //    case "connect":
               //       return (
               //          <PurchaseModal
               //             key={`purchase-${index}`}
               //             {...modal.props}
               //             onClose={() => closeModal("purchase")}
               //          />
               //       );
               //    case "viewPurchased":
               //       return (
               //          <ViewPurchasedVideoModal
               //             key={`viewPurchased-${index}`}
               //             {...modal.props}
               //             onClose={() => closeModal("viewPurchased")}
               //          />
               //       );
               //    case "auth":
               //       return (
               //          <AuthModal
               //             key={`auth-${index}`}
               //             {...modal.props}
               //             onClose={() => closeModal("auth")}
               //          />
               //       );
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
