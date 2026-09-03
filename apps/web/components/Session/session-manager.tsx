import useServers from "@/lib/hooks/queries/server/useServers";
import { authClient } from "@/lib/auth";
import useSessionStore from "@/lib/stores/sessionStore";
import { useEffect } from "react";

const SessionManager = () => {
   const { serverId, setUserId, setServerId, clearSession } = useSessionStore();
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
      if (servers.some((server) => server.id === serverId)) return;
      setServerId(servers[0]?.id ?? "");
   }, [userId, isServersLoading, servers, serverId, setServerId]);

   return null;
};

export default SessionManager;
