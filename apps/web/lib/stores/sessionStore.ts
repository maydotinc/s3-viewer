import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type SessionStoreState = {
   serverId: string;
   userId: string | null;
};

type SessionStoreActions = {
   setServerId: (serverId: string) => void;
   setUserId: (userId: string | null) => void;
   clearSession: () => void;
};

type SessionStore = SessionStoreState & SessionStoreActions;

const useSessionStore = create<SessionStore>()(
   persist(
      (set, get) => ({
         serverId: "",
         userId: null,
         setServerId: (serverId: string) => set({ serverId }),
         setUserId: (userId: string | null) => {
            const currentUserId = get().userId;
            if (currentUserId && currentUserId !== userId) {
               set({ userId, serverId: "" });
            } else {
               set({ userId });
            }
         },
         clearSession: () => {
            set({ serverId: "", userId: null });
         },
      }),
      {
         name: "session-storage",
         storage: createJSONStorage(() => localStorage),
      }
   )
);

export default useSessionStore;
