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
         setServerId: (serverId) => set({ serverId }),
         setUserId: (userId) =>
            set(
               get().userId && get().userId !== userId
                  ? { userId, serverId: "" }
                  : { userId }
            ),
         clearSession: () => set({ serverId: "", userId: null }),
      }),
      {
         name: "session-storage",
         storage: createJSONStorage(() => localStorage),
      }
   )
);

const useUserId = (): string => useSessionStore((state) => state.userId ?? "");

export default useSessionStore;
export { useUserId };
