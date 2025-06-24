import { fetchServersAPI, fetchServerUsersAPI } from "@/lib/api/server";
import { authClient } from "@s3-viewer/auth/client";
import { ServerInfo } from "@s3-viewer/types";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import useSessionStore from "../stores/sessionStore";

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
      queryFn: fetchServersAPI,
      enabled: isAuthenticated,
      staleTime: 1000 * 60 * 5, // 5 minutes
   });

   const {
      data: serverUsers = [],
      isPending: isServerUsersLoading,
      error: serverUsersError,
   } = useQuery({
      queryKey: ["server-users", serverId],
      queryFn: () => fetchServerUsersAPI(serverId),
      enabled: !!serverId && isAuthenticated,
   });

   useEffect(() => {
      if (isAuthenticated && servers.length > 0) {
         autoSelectServer(servers);
      }
   }, [servers, isAuthenticated, autoSelectServer]);

   const currentServer = servers.find((server) => server.id === serverId) || null;

   return {
      servers,
      currentServer,
      serverUsers,
      isServerUsersLoading,
      serverUsersError,
      isServerListLoading,
      serverError,
      selectServer,
      refreshServers: refetch,
   };
};

export default useServers;
