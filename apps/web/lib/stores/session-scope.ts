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

// the raw store state carries a null userId, which must not match a scope's ""
type ScopeParts = Record<keyof SessionScope, string | null>;

const sameScope = (left: ScopeParts, right: ScopeParts): boolean =>
   left.userId === right.userId && left.serverId === right.serverId;

const isScoped = (...parts: readonly (string | null | undefined)[]): boolean =>
   parts.every(Boolean);

export { getSessionScope, isScoped, sameScope, useServerId, useSessionScope };
export type { SessionScope };
