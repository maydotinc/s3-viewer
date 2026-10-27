import {
   defaultManageableServer,
   manageableServers,
} from "@/components/Invites/manageable";
import {
   receivedInvitesQuery,
   sentInvitesQuery,
} from "@/lib/hooks/queries/server/useInvites";
import { membersQuery } from "@/lib/hooks/queries/server/useMembers";
import useServers from "@/lib/hooks/queries/server/useServers";
import { prefetchCursorQuery } from "@/lib/hooks/queries/useCursorQuery";
import { sessionsQuery } from "@/lib/hooks/queries/user/useSessions";
import { useUserId } from "@/lib/stores/session-store";
import { SITE_PATHS } from "@s3-viewer/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

// a settings link warms its page's queries on hover or focus, so the page lands on rows instead of a skeleton
const usePrefetchSettings = () => {
   const queryClient = useQueryClient();
   const userId = useUserId();
   const { servers, currentServer } = useServers();

   return useCallback(
      (href: string) => {
         if (!userId) return;
         if (href === SITE_PATHS.settingsProfile) {
            void queryClient.prefetchQuery(sessionsQuery(userId));
         } else if (href === SITE_PATHS.settingsInvites) {
            void prefetchCursorQuery(queryClient, receivedInvitesQuery(userId));
         } else if (href === SITE_PATHS.settingsMembers) {
            const server = defaultManageableServer(
               manageableServers(servers),
               currentServer?.id
            );
            if (!server) return;
            void prefetchCursorQuery(
               queryClient,
               membersQuery(userId, server.id)
            );
            void queryClient.prefetchQuery(sentInvitesQuery(userId, server.id));
         }
      },
      [queryClient, userId, servers, currentServer?.id]
   );
};

export default usePrefetchSettings;
