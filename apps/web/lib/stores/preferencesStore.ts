import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type PreferencesStore = {
   foldersFirst: boolean;
   setFoldersFirst: (foldersFirst: boolean) => void;
};

const usePreferencesStore = create<PreferencesStore>()(
   persist(
      (set) => ({
         foldersFirst: true,
         setFoldersFirst: (foldersFirst) => set({ foldersFirst }),
      }),
      {
         name: "preferences-storage",
         storage: createJSONStorage(() => localStorage),
      }
   )
);

export default usePreferencesStore;
