import { create } from "zustand";

type SessionStore = {
    serverId: string;
    setServerId: (serverId: string) => void;
}

const useSessionStore = create<SessionStore>((set) => ({
    serverId: "",
    setServerId: (serverId: string) => set({ serverId }),
}));

export default useSessionStore;