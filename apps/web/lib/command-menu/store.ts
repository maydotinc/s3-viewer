import useSessionStore from "@/lib/stores/session-store";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const RECENT_LIMIT = 12;

type CommandMenuStore = {
   open: boolean;
   recentIds: string[];
   userId: string | null;
   openMenu: () => void;
   closeMenu: () => void;
   remember: (id: string) => void;
};

const useCommandMenuStore = create<CommandMenuStore>()(
   persist(
      (set, get) => ({
         open: false,
         recentIds: [],
         userId: useSessionStore.getState().userId,
         openMenu: () => {
            if (!get().open) set({ open: true });
         },
         closeMenu: () => {
            if (get().open) set({ open: false });
         },
         remember: (id) =>
            set({
               recentIds: [
                  id,
                  ...get().recentIds.filter((entry) => entry !== id),
               ].slice(0, RECENT_LIMIT),
            }),
      }),
      {
         name: "command-menu-storage",
         storage: createJSONStorage(() => window.localStorage),
         version: 1,
         partialize: ({ recentIds, userId }) => ({ recentIds, userId }),
      }
   )
);

const resetAccountRecents = () => {
   const userId = useSessionStore.getState().userId;
   const current = useCommandMenuStore.getState();
   useCommandMenuStore.setState({
      userId,
      recentIds: userId && current.userId === userId ? current.recentIds : [],
      open: false,
   });
};

resetAccountRecents();
useSessionStore.subscribe((state, previous) => {
   if (state.userId !== previous.userId) resetAccountRecents();
});

export default useCommandMenuStore;
