import useSessionStore, { useUserId } from "./session-store";

const useServerId = (): string => useSessionStore((state) => state.serverId);

type SessionScope = { userId: string; serverId: string };

const useSessionScope = (): SessionScope => ({
   userId: useUserId(),
   serverId: useServerId(),
});

const getSessionScope = (): SessionScope => {
   const { userId, serverId } = useSessionStore.getState();
   return { userId: userId ?? "", serverId };
};

const isScoped = (...parts: readonly (string | null | undefined)[]): boolean =>
   parts.every(Boolean);

export { getSessionScope, isScoped, useServerId, useSessionScope };
export type { SessionScope };
