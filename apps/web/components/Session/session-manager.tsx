import useServers from "@/lib/hooks/queries/server/useServers";
import { authClient } from "@/lib/auth";
import useSessionStore, { resolveServerId } from "@/lib/stores/sessionStore";
import { useEffect } from "react";

// selectors only: subscribing to the whole store would re-render on every
// `set`, including our own.
const SessionManager = () => {
   const serverId = useSessionStore((state) => state.serverId);
   const setServerId = useSessionStore((state) => state.setServerId);
   const { data: session } = authClient.useSession();
   const { servers, isLoading: isServersLoading } = useServers();
   const userId = session?.user.id ?? null;

   useEffect(() => {
      if (
         !userId ||
         isServersLoading ||
         useSessionStore.getState().userId !== userId
      )
         return;
      const next = resolveServerId(servers, serverId);
      if (next !== serverId) setServerId(next);
   }, [userId, isServersLoading, servers, serverId, setServerId]);

   return null;
};

export default SessionManager;
