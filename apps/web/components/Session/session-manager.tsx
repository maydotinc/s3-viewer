import useServers from "@/lib/hooks/queries/server/useServers";
import useSessionStore from "@/lib/stores/sessionStore";
import { authClient } from "@s3-viewer/auth/client";
import { useEffect } from "react";

const SessionManager = () => {
   const { serverId, setUserId, setServerId, clearSession } = useSessionStore();
   const { data: session, isPending } = authClient.useSession();
   const { servers, isLoading: isServersLoading } = useServers();

   useEffect(() => {
      if (isPending) return;

      if (session?.user) {
         setUserId(session.user.id);
      } else {
         clearSession();
      }
   }, [session?.user?.id, isPending, setUserId, clearSession]);

   useEffect(() => {
      if (!session?.user) return;
      if (isServersLoading) return;

      if (servers.length === 0) {
         if (serverId !== "") {
            setServerId("");
         }
         return;
      }

      const currentServer = servers.find((server) => server.id === serverId);
      if (!serverId || !currentServer) {
         const firstServer = servers[0];
         if (firstServer) {
            setServerId(firstServer.id);
         }
      }
   }, [session?.user?.id, isServersLoading, servers, serverId, setServerId]);

   return null;
};

export default SessionManager;
