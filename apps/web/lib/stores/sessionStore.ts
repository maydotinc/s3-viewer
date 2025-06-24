import { ServerInfo } from "@s3-viewer/types";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

type SessionStoreState = {
   serverId: string;
   userId: string | null;
};

type SessionStoreActions = {
   setServerId: (serverId: string) => void;
   setUserId: (userId: string | null) => void;
   selectServer: (serverId: string) => void;
   autoSelectServer: (servers: ServerInfo[]) => void;
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
         selectServer: (serverId: string) => {
            const { userId } = get();
            if (!userId) {
               return;
            }
            get().setServerId(serverId);
         },
         autoSelectServer: (servers: ServerInfo[]) => {
            const { serverId, userId } = get();

            if (!userId) return;

            // If no current server or current server not in list, select first available
            const currentServerExists = servers.some((server) => server.id === serverId);

            if (!serverId || !currentServerExists) {
               const firstServer = servers[0];
               if (firstServer) {
                  get().setServerId(firstServer.id);
               } else {
                  set({ serverId: "" });
               }
            }
         },
         clearSession: () => {
            set({ serverId: "", userId: null });
         },
      }),
      {
         name: "session-storage",
         storage: createJSONStorage(() => localStorage),
         onRehydrateStorage: () => (state) => {
            console.log("Session state loaded from localStorage:", state);
         },
      }
   )
);

export default useSessionStore;
