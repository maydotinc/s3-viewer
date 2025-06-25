import { fetchServers } from "@/lib/api/server";
import useSessionStore from "@/lib/stores/sessionStore";
import { authClient } from "@s3-viewer/auth/client";
import { ServerInfo } from "@s3-viewer/types";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

const useServers = () => {
   const { data: session } = authClient.useSession();
   const { serverId, selectServer, autoSelectServer } = useSessionStore();

   const isAuthenticated = !!session?.user;

   const {
      data: servers = [],
      isPending: isServerListLoading,
      error: serverError,
      refetch,
   } = useQuery<ServerInfo[]>({
      queryKey: ["servers"],
      queryFn: fetchServers,
      enabled: isAuthenticated,
      staleTime: 1000 * 60 * 5, // 5 minutes
   });

   useEffect(() => {
      if (isAuthenticated && servers.length > 0) {
         autoSelectServer(servers);
      }
   }, [servers, isAuthenticated, autoSelectServer]);

   const currentServer =
      servers.find((server) => server.id === serverId) || null;

   return {
      servers,
      currentServer,
      currentServerId: serverId,
      isServerListLoading,
      serverError,
      selectServer,
      refreshServers: refetch,
   };
};

export default useServers;
