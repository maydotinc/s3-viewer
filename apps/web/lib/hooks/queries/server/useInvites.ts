import { MAX_PAGE_SIZE } from "@s3-viewer/shared";
import { api, field, qs, serverPath } from "@/lib/api";
import useCursorQuery, { pageCursor } from "@/lib/hooks/queries/useCursorQuery";
import { queryKeys } from "@/lib/query-keys";
import { useUserId } from "@/lib/stores/session-store";
import type { InvitesPage, InvitesResponse } from "@s3-viewer/shared";
import { useQuery } from "@tanstack/react-query";

const PAGE_SIZE = MAX_PAGE_SIZE;

const pageInvites = (page: InvitesPage) => page.invites;

const receivedInvitesQuery = (userId: string) => ({
   queryKey: queryKeys.receivedInvites(userId),
   queryFn: (cursor: string | null, signal: AbortSignal) =>
      api.get<InvitesPage>(
         `/invites${qs({ cursor, limit: PAGE_SIZE })}`,
         signal
      ),
});

const sentInvitesQuery = (userId: string, serverId: string) => ({
   queryKey: queryKeys.sentInvites(userId, serverId),
   queryFn: ({ signal }: { signal: AbortSignal }) =>
      api
         .get<InvitesResponse>(`${serverPath(serverId)}/invites`, signal)
         .then(field("invites")),
});

const useReceivedInvites = () => {
   const userId = useUserId();
   const { items: invites, ...pages } = useCursorQuery({
      ...receivedInvitesQuery(userId),
      select: pageInvites,
      nextCursor: pageCursor,
      enabled: Boolean(userId),
      refetchOnWindowFocus: true,
   });
   return { ...pages, invites };
};

const useSentInvites = (serverId: string) => {
   const userId = useUserId();
   return useQuery({
      ...sentInvitesQuery(userId, serverId),
      enabled: Boolean(userId && serverId),
      refetchOnWindowFocus: true,
   });
};

export {
   receivedInvitesQuery,
   sentInvitesQuery,
   useReceivedInvites,
   useSentInvites,
};
