import React, { createContext, ReactNode, useContext, useState } from "react";

type ModalType = "auth" | "connect" | "createBucket" | "createObject";
interface ModalState {
   type: ModalType;
   props: ModalPropsMap[ModalType];
}

interface ModalContextType {
   openModal: <T extends ModalType>(modalType: T, modalProps: ModalPropsMap[T]) => void;
   closeModal: (modalType: ModalType) => void;
   modals: ModalState[];
   closeAllModals: () => void;
}

interface ModalPropsMap {
   auth: { page: "login" | "signup" };
   connect: {};
   createBucket: {};
   createObject: {};
}
const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
   const [modals, setModals] = useState<ModalState[]>([]);

   const openModal = <T extends ModalType>(type: T, props: ModalPropsMap[T]) => {
      window.document.body.style.overflow = "hidden";
      setModals((prevModals) => [
         ...prevModals,
         { type, props: props as ModalPropsMap[ModalType] },
      ]);
   };

   const closeModal = (modalType: ModalType) => {
      window.document.body.style.overflow = "auto";
      setModals((prevModals) => prevModals.filter((modal) => modal.type !== modalType));
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
      openAuthModal: (props: ModalPropsMap["auth"]) => context.openModal("auth", props),
      openConnectModal: (props: ModalPropsMap["connect"]) => context.openModal("connect", props),
      openCreateBucketModal: (props: ModalPropsMap["createBucket"]) =>
         context.openModal("createBucket", props),
      openCreateObjectModal: (props: ModalPropsMap["createObject"]) =>
         context.openModal("createObject", props),
   };
};
