import { ServerInfo, type S3DeleteTarget } from "@s3-viewer/types";
import useSessionStore from "@/lib/stores/sessionStore";
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
      userId: string;
      serverId: string;
      bucketName: string;
      objects: S3DeleteTarget[];
      onDeleteSuccess?: () => void;
   };
   rename: { server: ServerInfo };
   renameObject: {
      userId: string;
      serverId: string;
      bucketName: string;
      objectKey: string;
      expectedETag: string;
      onRenameSuccess?: (newObjectKey: string) => void;
   };
   disconnect: { server: ServerInfo };
   updateCredentials: { server: ServerInfo; onUpdated?: () => void };
};

type ModalType = keyof ModalPropsMap;

type OpenModals = { [K in ModalType]?: ModalPropsMap[K] };
type ModalScope = { userId: string | null; serverId: string };
type ScopedModals = { scope: ModalScope; modals: OpenModals };
const NO_MODALS: OpenModals = {};

const currentScope = (): ModalScope => {
   const { userId, serverId } = useSessionStore.getState();
   return { userId, serverId };
};
const sameScope = (left: ModalScope, right: ModalScope): boolean =>
   left.userId === right.userId && left.serverId === right.serverId;

type ModalActions = {
   closeModal: (type: ModalType) => void;
   openConnectModal: () => void;
   openCreateBucketModal: (props: ModalPropsMap["createBucket"]) => void;
   openConfirmDeleteModal: (
      props: Omit<ModalPropsMap["confirmDelete"], "userId">
   ) => void;
   openRenameModal: (props: ModalPropsMap["rename"]) => void;
   openRenameObjectModal: (
      props: Omit<ModalPropsMap["renameObject"], "userId">
   ) => void;
   openDisconnectModal: (props: ModalPropsMap["disconnect"]) => void;
   openUpdateCredentialsModal: (
      props: ModalPropsMap["updateCredentials"]
   ) => void;
};

const ModalActionsContext = createContext<ModalActions | null>(null);
const ModalStateContext = createContext<OpenModals | null>(null);

const ModalProvider = ({ children }: { children: ReactNode }) => {
   const userId = useSessionStore((state) => state.userId);
   const serverId = useSessionStore((state) => state.serverId);
   const [state, setState] = useState<ScopedModals>(() => ({
      scope: currentScope(),
      modals: NO_MODALS,
   }));
   // Hide stale dialogs in this render, before effects run. Their captured
   // target must never follow a new selection or a different signed-in user.
   const modals = sameScope(state.scope, { userId, serverId })
      ? state.modals
      : NO_MODALS;
   const anyOpen = Object.keys(modals).length > 0;

   useEffect(() => {
      setState((previous) =>
         sameScope(previous.scope, { userId, serverId })
            ? previous
            : { scope: { userId, serverId }, modals: NO_MODALS }
      );
   }, [userId, serverId]);

   useEffect(() => {
      if (!anyOpen) return;
      const previous = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
         document.body.style.overflow = previous;
      };
   }, [anyOpen]);

   const open = useCallback(
      <T extends ModalType>(type: T, props: ModalPropsMap[T]) => {
         const scope = currentScope();
         setState((previous) => {
            return {
               scope,
               modals: {
                  ...(sameScope(previous.scope, scope)
                     ? previous.modals
                     : NO_MODALS),
                  [type]: props,
               },
            };
         });
      },
      []
   );

   const closeModal = useCallback(
      (type: ModalType) =>
         setState((previous) => {
            const next = { ...previous.modals };
            delete next[type];
            return { ...previous, modals: next };
         }),
      []
   );

   // stable identity, so opening a modal re-renders only the modal renderer.
   const actions = useMemo<ModalActions>(
      () => ({
         closeModal,
         openConnectModal: () => open("connect", {}),
         openCreateBucketModal: (p) => open("createBucket", p),
         openConfirmDeleteModal: (p) => {
            const scope = currentScope();
            if (!scope.userId || scope.serverId !== p.serverId) return;
            open("confirmDelete", { ...p, userId: scope.userId });
         },
         openRenameModal: (p) => open("rename", p),
         openRenameObjectModal: (p) => {
            const scope = currentScope();
            if (!scope.userId || scope.serverId !== p.serverId) return;
            open("renameObject", { ...p, userId: scope.userId });
         },
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
