import { ServerInfo } from "@s3-viewer/types";
import React, { createContext, ReactNode, useContext, useState } from "react";

type ModalType = "auth" | "connect" | "createBucket" | "createObject" | "rename" | "disconnect";

type ModalPropsMap = {
   auth: {};
   connect: {};
   createBucket: { serverId: string };
   createObject: { serverId: string };
   rename: {
      server: ServerInfo;
   };
   disconnect: {
      server: ServerInfo;
   };
};

type ModalState = {
   [K in ModalType]: {
      type: K;
      props: ModalPropsMap[K];
   };
}[ModalType];

interface ModalContextType {
   openModal: <T extends ModalType>(modalType: T, props: ModalPropsMap[T]) => void;
   closeModal: (modalType: ModalType) => void;
   modals: ModalState[];
   closeAllModals: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
   const [modals, setModals] = useState<ModalState[]>([]);

   const openModal = <T extends ModalType>(type: T, props: ModalPropsMap[T]) => {
      window.document.body.style.overflow = "hidden";
      setModals((prevModals) => [...prevModals, { type, props } as ModalState]);
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
      openAuthModal: () => context.openModal("auth", {}),
      openConnectModal: () => context.openModal("connect", {}),
      openCreateBucketModal: (props: ModalPropsMap["createBucket"]) =>
         context.openModal("createBucket", props),
      openCreateObjectModal: (props: ModalPropsMap["createObject"]) =>
         context.openModal("createObject", props),
      openRenameModal: (props: ModalPropsMap["rename"]) => context.openModal("rename", props),
      openDisconnectModal: (props: ModalPropsMap["disconnect"]) =>
         context.openModal("disconnect", props),
   };
};
