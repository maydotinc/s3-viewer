import { queryKeys } from "@/lib/query-keys";
import { useServerId } from "@/lib/stores/session-scope";
import { useUserId } from "@/lib/stores/session-store";
import type { ServerInfo } from "@s3-viewer/shared";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import useServerInfo from "./useServerInfo";

// the session's selected server; a /servers/[serverId] page selects its own through useUrlServer
const useSessionServer = (): {
   currentServer: ServerInfo | null;
   isLoading: boolean;
} => {
   const queryClient = useQueryClient();
   const userId = useUserId();
   const serverId = useServerId();
   const selected = useServerInfo(serverId);
   const serversKey = queryKeys.servers(userId);
   const listFetching =
      useIsFetching({ queryKey: serversKey, exact: true }) > 0;
   const listLoading =
      listFetching && queryClient.getQueryData(serversKey) === undefined;
   return {
      currentServer: selected.data ?? null,
      isLoading: selected.isLoading || (!serverId && listLoading),
   };
};

export default useSessionServer;
