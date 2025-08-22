import { ServerInfo } from "@s3-viewer/types";
import React, { createContext, ReactNode, useContext, useState } from "react";

type ModalType =
   | "auth"
   | "connect"
   | "createBucket"
   | "confirmDelete"
   | "rename"
   | "disconnect"
   | "share"
   | "invites";

type ModalPropsMap = {
   auth: {};
   connect: {};
   createBucket: { serverId?: string };
   confirmDelete: {
      serverId: string;
      bucketName: string;
      fileNames: string[];
      onDeleteSuccess?: () => void;
   };
   rename: {
      server: ServerInfo;
   };
   disconnect: {
      server: ServerInfo;
   };
   share: {
      server?: ServerInfo;
   };
   invites: {};
};

type ModalState = {
   [K in ModalType]: {
      type: K;
      props: ModalPropsMap[K];
   };
}[ModalType];

interface ModalContextType {
   openModal: <T extends ModalType>(
      modalType: T,
      props: ModalPropsMap[T]
   ) => void;
   closeModal: (modalType: ModalType) => void;
   modals: ModalState[];
   closeAllModals: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: ReactNode }> = ({
   children,
}) => {
   const [modals, setModals] = useState<ModalState[]>([]);

   const openModal = <T extends ModalType>(
      type: T,
      props: ModalPropsMap[T]
   ) => {
      // Only blur if the focused element will be hidden by the modal
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && !activeElement.closest("[data-radix-portal]")) {
         activeElement.blur();
      }

      if (modals.length === 0) {
         window.document.body.style.overflow = "hidden";
      }
      setModals((prevModals) => [...prevModals, { type, props } as ModalState]);
   };

   const closeModal = (modalType: ModalType) => {
      setModals((prevModals) => {
         const newModals = prevModals.filter(
            (modal) => modal.type !== modalType
         );
         if (newModals.length === 0) {
            window.document.body.style.overflow = "auto";
         }
         return newModals;
      });
   };

   const closeAllModals = () => {
      window.document.body.style.overflow = "auto";
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
      openConfirmDeleteModal: (props: ModalPropsMap["confirmDelete"]) =>
         context.openModal("confirmDelete", props),
      openRenameModal: (props: ModalPropsMap["rename"]) =>
         context.openModal("rename", props),
      openDisconnectModal: (props: ModalPropsMap["disconnect"]) =>
         context.openModal("disconnect", props),
      openShareModal: (props: ModalPropsMap["share"]) =>
         context.openModal("share", props),
      openInvitesModal: () => context.openModal("invites", {}),
   };
};
