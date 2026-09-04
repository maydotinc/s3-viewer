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

const EMPTY_SESSION: SessionStoreState = { serverId: "", userId: null };

const resolveServerId = (
   servers: readonly { id: string }[],
   current: string
): string =>
   servers.some((server) => server.id === current)
      ? current
      : (servers[0]?.id ?? "");

// Every setter is a no-op when nothing changes: zustand emits on every `set`
// call even when the values are identical, and an effect that re-sets the
// same value on each render would otherwise re-render itself forever.
const useSessionStore = create<SessionStore>()(
   persist(
      (set, get) => ({
         ...EMPTY_SESSION,
         setServerId: (serverId) => {
            if (get().serverId !== serverId) set({ serverId });
         },
         setUserId: (userId) => {
            const previous = get().userId;
            if (previous === userId) return;
            // A different account must not inherit the previous selection.
            set(previous ? { userId, serverId: "" } : { userId });
         },
         clearSession: () => {
            const { serverId, userId } = get();
            if (serverId || userId) set(EMPTY_SESSION);
         },
      }),
      {
         name: "session-storage",
         storage: createJSONStorage(() => localStorage),
      }
   )
);

const useUserId = (): string => useSessionStore((state) => state.userId ?? "");

export default useSessionStore;
export { resolveServerId, useUserId };
