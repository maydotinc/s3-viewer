import useServers from "@/lib/hooks/queries/server/useServers";
import { authClient } from "@/lib/auth";
import useSessionStore, { resolveServerId } from "@/lib/stores/sessionStore";
import { useEffect } from "react";

// selectors only: subscribing to the whole store would re-render on every
// `set`, including our own.
const SessionManager = () => {
   const serverId = useSessionStore((state) => state.serverId);
   const setUserId = useSessionStore((state) => state.setUserId);
   const setServerId = useSessionStore((state) => state.setServerId);
   const clearSession = useSessionStore((state) => state.clearSession);
   const { data: session, isPending } = authClient.useSession();
   const { servers, isLoading: isServersLoading } = useServers();
   const userId = session?.user.id ?? null;

   useEffect(() => {
      if (isPending) return;
      if (userId) setUserId(userId);
      else clearSession();
   }, [userId, isPending, setUserId, clearSession]);

   useEffect(() => {
      if (!userId || isServersLoading) return;
      const next = resolveServerId(servers, serverId);
      if (next !== serverId) setServerId(next);
   }, [userId, isServersLoading, servers, serverId, setServerId]);

   return null;
};

export default SessionManager;
