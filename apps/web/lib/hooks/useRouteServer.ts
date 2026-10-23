import { ApiError } from "@/lib/api";
import useServerInfo from "@/lib/hooks/queries/server/useServerInfo";
import { useServerId } from "@/lib/stores/session-scope";
import useSessionStore from "@/lib/stores/session-store";
import { useCallback, useEffect } from "react";

// switching servers navigates away before it selects, so while this page is open a selection other than the URL's
// comes from a reset (an account switch, a cleared session) and the URL's server is selected again whenever the user holds it
const useRouteServer = (serverId: string) => {
   const sessionServerId = useServerId();
   const {
      data: server,
      error,
      isLoading,
      isMissing,
      isRefetching,
      refetch,
   } = useServerInfo(serverId);
   const setServerId = useSessionStore((state) => state.setServerId);

   useEffect(() => {
      if (server && sessionServerId !== serverId) setServerId(serverId);
   }, [server, serverId, sessionServerId, setServerId]);

   const retry = useCallback(() => void refetch(), [refetch]);

   // a server that doesn't exist and one the user isn't a member of answer alike
   const refused =
      isMissing || (error instanceof ApiError && error.status === 403);
   const settled = Boolean(serverId) && !isLoading && !server;
   return {
      unavailable: settled && refused,
      error: settled && !refused ? error : null,
      retry,
      retrying: isRefetching,
   };
};

export { useRouteServer };
