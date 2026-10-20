import { api, qs } from "@/lib/api";
import useCursorQuery, { pageCursor } from "@/lib/hooks/queries/useCursorQuery";
import { useSessionReady } from "@/lib/hooks/useSessionReady";
import { queryKeys } from "@/lib/query-keys";
import { useServerId } from "@/lib/stores/session-scope";
import { useUserId } from "@/lib/stores/session-store";
import type { ServerInfo, ServerPage } from "@s3-viewer/types";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import useServerInfo from "./useServerInfo";

const NO_SERVERS: ServerInfo[] = [];

const pageServers = (page: ServerPage) => page.servers;

const useServers = () => {
   const queryClient = useQueryClient();
   const { isSessionReady, isSessionPending } = useSessionReady();
   const userId = useUserId();
   const serverId = useServerId();
   const selected = useServerInfo(serverId);
   const { items: listed, ...query } = useCursorQuery({
      queryKey: queryKeys.servers(userId),
      queryFn: (cursor, signal) =>
         api.get<ServerPage>(`/servers${qs({ cursor })}`, signal),
      select: pageServers,
      nextCursor: pageCursor,
      enabled: isSessionReady,
   });

   const { data } = query;
   useEffect(() => {
      if (!isSessionReady || !selected.isMissing || !data) return;
      queryClient.setQueryData<InfiniteData<ServerPage>>(
         queryKeys.servers(userId),
         (previous) => {
            if (
               !previous?.pages.some((page) =>
                  page.servers.some((server) => server.id === serverId)
               )
            )
               return previous;
            return {
               ...previous,
               pages: previous.pages.map((page) => ({
                  ...page,
                  servers: page.servers.filter(
                     (server) => server.id !== serverId
                  ),
               })),
            };
         }
      );
   }, [
      data,
      isSessionReady,
      selected.isMissing,
      serverId,
      userId,
      queryClient,
   ]);
   const currentServer = selected.data ?? null;
   const servers = useMemo(() => {
      if (!isSessionReady || (!data && !currentServer)) return NO_SERVERS;
      const available = new Map(
         listed.map((server) => [server.id, server] as const)
      );
      if (selected.isMissing) available.delete(serverId);
      if (currentServer) available.set(currentServer.id, currentServer);
      return [...available.values()];
   }, [
      data,
      listed,
      currentServer,
      selected.isMissing,
      serverId,
      isSessionReady,
   ]);

   return {
      servers,
      currentServer,
      isCurrentServerMissing: selected.isMissing,
      isSessionPending,
      isServerListLoading: query.isLoading,
      isLoading:
         isSessionPending || (serverId ? selected.isLoading : query.isLoading),
      serverError: selected.error,
      refetchCurrentServer: selected.refetch,
      isFetchingCurrentServer: selected.isFetching,
      serverListError: query.error,
      hasNextPage: query.hasNextPage,
      isFetchNextPageError: query.isFetchNextPageError,
      isFetching: query.isFetching,
      fetchNextPage: query.fetchNextPage,
      refetch: query.refetch,
   };
};

export default useServers;
