import type { ModalPropsMap, ModalType, ScopedModalType } from "./modal-props";
import {
   getSessionScope,
   sameScope,
   useServerId,
   type SessionScope,
} from "@/lib/stores/session-scope";
import { useUserId } from "@/lib/stores/session-store";
import {
   ReactNode,
   createContext,
   useCallback,
   useContext,
   useEffect,
   useMemo,
   useState,
} from "react";

type OpenModals = { [K in ModalType]?: ModalPropsMap[K] };
type ScopedModals = { scope: SessionScope; modals: OpenModals };
const NO_MODALS: OpenModals = {};

type ScopedProps<T extends ScopedModalType> = Omit<ModalPropsMap[T], "userId">;

type ModalActions = {
   closeModal: (type: ModalType) => void;
   open: <T extends Exclude<ModalType, ScopedModalType>>(
      type: T,
      props: ModalPropsMap[T]
   ) => void;
   openScoped: <T extends ScopedModalType>(
      type: T,
      props: ScopedProps<T>
   ) => void;
};

const ModalActionsContext = createContext<ModalActions | null>(null);
const ModalStateContext = createContext<OpenModals | null>(null);

const ModalProvider = ({ children }: { children: ReactNode }) => {
   const userId = useUserId();
   const serverId = useServerId();
   const [state, setState] = useState<ScopedModals>(() => ({
      scope: getSessionScope(),
      modals: NO_MODALS,
   }));
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

   const show = useCallback(
      <T extends ModalType>(type: T, props: ModalPropsMap[T]) => {
         const scope = getSessionScope();
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

   const openScoped = useCallback(
      <T extends ScopedModalType>(type: T, props: ScopedProps<T>) => {
         const scope = getSessionScope();
         if (!scope.userId || scope.serverId !== props.serverId) return;
         show(type, { ...props, userId: scope.userId } as ModalPropsMap[T]);
      },
      [show]
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

   const actions = useMemo<ModalActions>(
      () => ({ closeModal, open: show, openScoped }),
      [show, openScoped, closeModal]
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
