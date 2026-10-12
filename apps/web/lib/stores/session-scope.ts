import useSessionStore, { useUserId } from "./session-store";

const useServerId = (): string => useSessionStore((state) => state.serverId);

const useSessionScope = (): { userId: string; serverId: string } => ({
   userId: useUserId(),
   serverId: useServerId(),
});

const isScoped = (...parts: readonly (string | null | undefined)[]): boolean =>
   parts.every(Boolean);

export { isScoped, useServerId, useSessionScope };
