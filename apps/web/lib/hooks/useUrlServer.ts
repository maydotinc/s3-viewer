import { ApiError } from "@/lib/api";
import useServerInfo from "@/lib/hooks/queries/server/useServerInfo";
import { useServerId } from "@/lib/stores/session-scope";
import useSessionStore from "@/lib/stores/session-store";
import { SITE_PATHS, type ServerInfo } from "@s3-viewer/shared";
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef } from "react";

type FollowSession = {
   canOpen: (server: ServerInfo) => boolean;
   pathFor: (serverId: string) => string;
};

// switching servers navigates away before it selects, so while this page is open a selection other than the URL's
// comes from a reset (an account switch, a cleared session). by default the URL's server is selected again whenever
// the user holds it; with `follow` the URL's server is selected once and the page then moves to the session's server
const useUrlServer = (serverId: string, follow?: FollowSession) => {
   const router = useRouter();
   const sessionServerId = useServerId();
   const {
      data: server,
      error,
      isLoading,
      isMissing,
      isRefetching,
      refetch,
   } = useServerInfo(serverId);
   const session = useServerInfo(follow ? sessionServerId : "");
   const setServerId = useSessionStore((state) => state.setServerId);
   const adoptedRef = useRef<string | null>(null);
   const canOpen = follow?.canOpen;
   const pathFor = follow?.pathFor;
   const allowed = server ? (canOpen?.(server) ?? true) : false;

   useEffect(() => {
      if (!server || !allowed || sessionServerId === serverId) return;
      if (!canOpen || !pathFor || adoptedRef.current !== serverId) {
         adoptedRef.current = serverId;
         setServerId(serverId);
         return;
      }
      if (!sessionServerId || session.isLoading || session.error) return;
      void router.replace(
         session.data && canOpen(session.data)
            ? pathFor(sessionServerId)
            : SITE_PATHS.dashboard
      );
   }, [
      allowed,
      canOpen,
      pathFor,
      router,
      server,
      serverId,
      session.data,
      session.isLoading,
      session.error,
      sessionServerId,
      setServerId,
   ]);

   const retry = useCallback(() => void refetch(), [refetch]);

   // a server that doesn't exist and one the user isn't a member of answer alike
   const refused =
      isMissing || (error instanceof ApiError && error.status === 403);
   const settled = Boolean(serverId) && !isLoading && !server;
   return {
      server: server ?? null,
      allowed,
      isLoading,
      adopted: sessionServerId === serverId,
      unavailable: settled && refused,
      error: settled && !refused ? error : null,
      retry,
      retrying: isRefetching,
   };
};

export { useUrlServer };
