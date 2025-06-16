import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";


type SessionStore = {
    serverId: string;
    setServerId: (serverId: string) => void;
}

const useSessionStore = create<SessionStore>()(
    persist(
        (set) => ({
            serverId: "",
            setServerId: (serverId: string) => {
                console.log('Saving to localStorage:', { serverId });
                set({ serverId });
            },
        }),
        {
            name: 'session-storage',
            storage: createJSONStorage(() => localStorage),
            onRehydrateStorage: () => (state) => {
                console.log('State loaded from localStorage:', state);
            },
        }
    )
);

export default useSessionStore;