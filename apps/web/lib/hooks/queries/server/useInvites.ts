import { MAX_PAGE_SIZE } from "@s3-viewer/types";
import { api, field, qs, serverPath } from "@/lib/api";
import useCursorQuery, { pageCursor } from "@/lib/hooks/queries/useCursorQuery";
import { queryKeys } from "@/lib/query-keys";
import { useUserId } from "@/lib/stores/session-store";
import type { InvitesPage, InvitesResponse } from "@s3-viewer/types";
import { useQuery } from "@tanstack/react-query";

const PAGE_SIZE = MAX_PAGE_SIZE;

const pageInvites = (page: InvitesPage) => page.invites;

const useReceivedInvites = () => {
   const userId = useUserId();
   const { items: invites, ...pages } = useCursorQuery({
      queryKey: queryKeys.receivedInvites(userId),
      queryFn: (cursor, signal) =>
         api.get<InvitesPage>(
            `/invites${qs({ cursor, limit: PAGE_SIZE })}`,
            signal
         ),
      select: pageInvites,
      nextCursor: pageCursor,
      enabled: Boolean(userId),
   });
   return { ...pages, invites };
};

const useSentInvites = (serverId: string) => {
   const userId = useUserId();
   return useQuery({
      queryKey: queryKeys.sentInvites(userId, serverId),
      queryFn: ({ signal }) =>
         api
            .get<InvitesResponse>(`${serverPath(serverId)}/invites`, signal)
            .then(field("invites")),
      enabled: Boolean(userId && serverId),
   });
};

export { useReceivedInvites, useSentInvites };
export type { InvitesPage };
