import { ApiError, api, field, serverPath } from "@/lib/api";
import { useSessionReady } from "@/lib/hooks/useSessionReady";
import { queryKeys } from "@/lib/query-keys";
import { useUserId } from "@/lib/stores/session-store";
import type { ServerInfo } from "@s3-viewer/types";
import { useQuery } from "@tanstack/react-query";

const useServerInfo = (serverId: string) => {
   const userId = useUserId();
   const { isSessionReady, isSessionPending } = useSessionReady();
   const query = useQuery({
      queryKey: queryKeys.serverInfo(userId, serverId),
      queryFn: ({ signal }) =>
         api
            .get<{ server: ServerInfo }>(serverPath(serverId), signal)
            .then(field("server")),
      enabled: Boolean(serverId) && isSessionReady,
   });
   const isMissing =
      query.error instanceof ApiError && query.error.status === 404;
   return {
      ...query,
      data: !isSessionReady || isMissing ? undefined : query.data,
      isLoading: isSessionPending || query.isLoading,
      isMissing,
   };
};

export default useServerInfo;
