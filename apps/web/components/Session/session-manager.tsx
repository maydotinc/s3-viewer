import useServers from "@/lib/hooks/queries/server/useServers";
import { authClient } from "@/lib/auth";
import { useServerId } from "@/lib/stores/session-scope";
import useSessionStore, { resolveServerId } from "@/lib/stores/session-store";
import { useEffect } from "react";

const SessionManager = () => {
   const serverId = useServerId();
   const setServerId = useSessionStore((state) => state.setServerId);
   const { data: session } = authClient.useSession();
   const {
      servers,
      isServerListLoading,
      serverListError,
      isCurrentServerMissing,
   } = useServers();
   const userId = session?.user.id ?? null;

   useEffect(() => {
      if (
         !userId ||
         isServerListLoading ||
         serverListError ||
         (serverId && !isCurrentServerMissing) ||
         useSessionStore.getState().userId !== userId
      )
         return;
      const next = resolveServerId(servers, serverId);
      if (next !== serverId) setServerId(next);
   }, [
      userId,
      isServerListLoading,
      serverListError,
      isCurrentServerMissing,
      servers,
      serverId,
      setServerId,
   ]);

   return null;
};

export default SessionManager;
