import React, { createContext, ReactNode, useContext, useState } from "react";

type ModalType = "auth" | "connect" | "createBucket" | "createObject";
interface ModalContextType {
   openModal: (modalType: ModalType) => void;
   closeModal: (modalType: ModalType) => void;
   modals: ModalType[];
   closeAllModals: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
   const [modals, setModals] = useState<ModalType[]>([]);

   const openModal = (type: ModalType) => {
      window.document.body.style.overflow = "hidden";
      setModals((prevModals) => [...prevModals, type]);
   };

   const closeModal = (modalType: ModalType) => {
      window.document.body.style.overflow = "auto";
      setModals((prevModals) => prevModals.filter((modal) => modal !== modalType));
   };

   const closeAllModals = () => {
      setModals([]);
   };

   return (
      <ModalContext.Provider
         value={{
            openModal,
            closeModal,
            modals,
            closeAllModals,
         }}
      >
         {children}
      </ModalContext.Provider>
   );
};

export const useModalContext = () => {
   const context = useContext(ModalContext);
   if (context === undefined) {
      throw new Error("useModal must be used within a ModalProvider");
   }
   return {
      ...context,
      openAuthModal: () => context.openModal("auth"),
      openConnectModal: () => context.openModal("connect"),
      openCreateBucketModal: () => context.openModal("createBucket"),
      openCreateObjectModal: () => context.openModal("createObject"),
   };
};
