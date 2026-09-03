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
   share: { server?: ServerInfo };
   updateCredentials: { server: ServerInfo; onUpdated?: () => void };
};

type ModalType = keyof ModalPropsMap;

type OpenModals = { [K in ModalType]?: ModalPropsMap[K] };

type ModalContextValue = {
   modals: OpenModals;
   closeModal: (type: ModalType) => void;
   openConnectModal: () => void;
   openCreateBucketModal: (props: ModalPropsMap["createBucket"]) => void;
   openConfirmDeleteModal: (props: ModalPropsMap["confirmDelete"]) => void;
   openRenameModal: (props: ModalPropsMap["rename"]) => void;
   openRenameObjectModal: (props: ModalPropsMap["renameObject"]) => void;
   openDisconnectModal: (props: ModalPropsMap["disconnect"]) => void;
   openShareModal: (props: ModalPropsMap["share"]) => void;
   openUpdateCredentialsModal: (
      props: ModalPropsMap["updateCredentials"]
   ) => void;
};

const ModalContext = createContext<ModalContextValue | null>(null);

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

   const value = useMemo<ModalContextValue>(
      () => ({
         modals,
         closeModal,
         openConnectModal: () => open("connect", {}),
         openCreateBucketModal: (p) => open("createBucket", p),
         openConfirmDeleteModal: (p) => open("confirmDelete", p),
         openRenameModal: (p) => open("rename", p),
         openRenameObjectModal: (p) => open("renameObject", p),
         openDisconnectModal: (p) => open("disconnect", p),
         openShareModal: (p) => open("share", p),
         openUpdateCredentialsModal: (p) => open("updateCredentials", p),
      }),
      [modals, closeModal, open]
   );

   return (
      <ModalContext.Provider value={value}>{children}</ModalContext.Provider>
   );
};

const useModalContext = (): ModalContextValue => {
   const context = useContext(ModalContext);
   if (!context) {
      throw new Error("useModalContext must be used within a ModalProvider");
   }
   return context;
};

export { ModalProvider, useModalContext };
