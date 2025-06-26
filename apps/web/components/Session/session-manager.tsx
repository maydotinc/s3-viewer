import useServers from "@/lib/hooks/queries/useServers";
import useSessionStore from "@/lib/stores/sessionStore";
import { authClient } from "@s3-viewer/auth/client";
import { useEffect } from "react";

const SessionManager = () => {
   const { data: session, isPending } = authClient.useSession();
   const { servers } = useServers();
   const { serverId, setUserId, setServerId, clearSession } = useSessionStore();

   useEffect(() => {
      if (isPending) return;

      if (session?.user) {
         setUserId(session.user.id);
      } else {
         clearSession();
      }
   }, [session, isPending, clearSession]);

   useEffect(() => {
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
   }, [servers.length]);

   return null;
};

export default SessionManager;
