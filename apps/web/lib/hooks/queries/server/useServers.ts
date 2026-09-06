import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { authClient } from "@/lib/auth";
import useSessionStore, { useUserId } from "@/lib/stores/sessionStore";
import { ServerInfo } from "@s3-viewer/types";
import { useQuery } from "@tanstack/react-query";

// shared instance: an inline `= []` default would be a new array every render
// and re-trigger every memo and effect depending on it.
const NO_SERVERS: ServerInfo[] = [];

const useServers = () => {
   const { isPending: isSessionPending } = authClient.useSession();
   const userId = useUserId();
   const serverId = useSessionStore((state) => state.serverId);

   const {
      data,
      isLoading: isServerListLoading,
      error: serverError,
   } = useQuery({
      queryKey: queryKeys.servers(userId),
      queryFn: async () =>
         (await api.get<{ servers: ServerInfo[] }>("/servers")).servers,
      // the user id is persisted across loads, so on its own it may belong to
      // a session that has since ended; the session manager reconciles it once
      // the session request answers
      enabled: Boolean(userId) && !isSessionPending,
   });
   const servers = data ?? NO_SERVERS;

   const currentServer = servers.find((s) => s.id === serverId) ?? null;

   return {
      servers,
      currentServer,
      isSessionPending,
      isServerListLoading,
      isLoading: isSessionPending || isServerListLoading,
      serverError,
   };
};

export default useServers;
