import { useModalContext } from "@/lib/contexts/ModalContext";
import { useRouter } from "next/router";
import { useEffect } from "react";

const ModalManager = () => {
   const router = useRouter();
   const { modals, closeModal, openAuthModal } = useModalContext();

   useEffect(() => {
      if (router.query.verifyRequest === "true") {
         openAuthModal({ page: "login" });
      }
   }, [router.query.verifyRequest]);

   return (
      <>
         {modals.map((modal, index) => {
            switch (modal.type) {
               case "wallet":
                  return (
                     <WalletModal
                        key={`wallet-${index}`}
                        {...modal.props}
                        onClose={() => closeModal("wallet")}
                     />
                  );
               case "purchase":
                  return (
                     <PurchaseModal
                        key={`purchase-${index}`}
                        {...modal.props}
                        onClose={() => closeModal("purchase")}
                     />
                  );
               case "viewPurchased":
                  return (
                     <ViewPurchasedVideoModal
                        key={`viewPurchased-${index}`}
                        {...modal.props}
                        onClose={() => closeModal("viewPurchased")}
                     />
                  );
               case "auth":
                  return (
                     <AuthModal
                        key={`auth-${index}`}
                        {...modal.props}
                        onClose={() => closeModal("auth")}
                     />
                  );
               case "delete":
                  return (
                     <DeleteModal
                        key={`delete-${index}`}
                        {...modal.props}
                        onClose={() => closeModal("delete")}
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
