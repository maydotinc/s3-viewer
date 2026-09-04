import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// more ids than Recent ever shows, so a renamed bucket or a revoked
// permission thins the list without emptying it.
const RECENT_LIMIT = 12;

type CommandMenuStore = {
   open: boolean;
   recentIds: string[];
   openMenu: () => void;
   closeMenu: () => void;
   remember: (id: string) => void;
};

const useCommandMenuStore = create<CommandMenuStore>()(
   persist(
      (set, get) => ({
         open: false,
         recentIds: [],
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
         storage: createJSONStorage(() => localStorage),
         partialize: ({ recentIds }) => ({ recentIds }),
      }
   )
);

export default useCommandMenuStore;
export { RECENT_LIMIT };
