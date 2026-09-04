import { ServerInfo } from "@s3-viewer/types";
import {
   ReactNode,
   createContext,
   useCallback,
   useContext,
   useEffect,
   useMemo,
   useState,
} from "react";

type ModalPropsMap = {
   connect: Record<never, never>;
   createBucket: Record<never, never>;
   confirmDelete: {
      serverId: string;
      bucketName: string;
      objectKeys: string[];
      onDeleteSuccess?: () => void;
   };
   rename: { server: ServerInfo };
   renameObject: {
      serverId: string;
      bucketName: string;
      objectKey: string;
      onRenameSuccess?: (newObjectKey: string) => void;
   };
   disconnect: { server: ServerInfo };
   updateCredentials: { server: ServerInfo; onUpdated?: () => void };
};

type ModalType = keyof ModalPropsMap;

type OpenModals = { [K in ModalType]?: ModalPropsMap[K] };

type ModalActions = {
   closeModal: (type: ModalType) => void;
   openConnectModal: () => void;
   openCreateBucketModal: (props: ModalPropsMap["createBucket"]) => void;
   openConfirmDeleteModal: (props: ModalPropsMap["confirmDelete"]) => void;
   openRenameModal: (props: ModalPropsMap["rename"]) => void;
   openRenameObjectModal: (props: ModalPropsMap["renameObject"]) => void;
   openDisconnectModal: (props: ModalPropsMap["disconnect"]) => void;
   openUpdateCredentialsModal: (
      props: ModalPropsMap["updateCredentials"]
   ) => void;
};

const ModalActionsContext = createContext<ModalActions | null>(null);
const ModalStateContext = createContext<OpenModals | null>(null);

const ModalProvider = ({ children }: { children: ReactNode }) => {
   const [modals, setModals] = useState<OpenModals>({});
   const anyOpen = Object.keys(modals).length > 0;

   useEffect(() => {
      if (!anyOpen) return;
      const previous = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
         document.body.style.overflow = previous;
      };
   }, [anyOpen]);

   const open = useCallback(
      <T extends ModalType>(type: T, props: ModalPropsMap[T]) =>
         setModals((prev) => ({ ...prev, [type]: props })),
      []
   );

   const closeModal = useCallback(
      (type: ModalType) =>
         setModals((prev) => {
            const next = { ...prev };
            delete next[type];
            return next;
         }),
      []
   );

   // stable identity, so opening a modal re-renders only the modal renderer.
   const actions = useMemo<ModalActions>(
      () => ({
         closeModal,
         openConnectModal: () => open("connect", {}),
         openCreateBucketModal: (p) => open("createBucket", p),
         openConfirmDeleteModal: (p) => open("confirmDelete", p),
         openRenameModal: (p) => open("rename", p),
         openRenameObjectModal: (p) => open("renameObject", p),
         openDisconnectModal: (p) => open("disconnect", p),
         openUpdateCredentialsModal: (p) => open("updateCredentials", p),
      }),
      [open, closeModal]
   );

   return (
      <ModalActionsContext.Provider value={actions}>
         <ModalStateContext.Provider value={modals}>
            {children}
         </ModalStateContext.Provider>
      </ModalActionsContext.Provider>
   );
};

const useModalActions = (): ModalActions => {
   const actions = useContext(ModalActionsContext);
   if (!actions) {
      throw new Error("useModalActions must be used within a ModalProvider");
   }
   return actions;
};

const useModalState = (): OpenModals => {
   const modals = useContext(ModalStateContext);
   if (!modals) {
      throw new Error("useModalState must be used within a ModalProvider");
   }
   return modals;
};

export { ModalProvider, useModalActions, useModalState };
