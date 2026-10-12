import { MAX_PAGE_SIZE } from "@s3-viewer/types";
import { api, field, qs, serverPath } from "@/lib/api";
import useCursorQuery, { pageCursor } from "@/lib/hooks/queries/useCursorQuery";
import { queryKeys } from "@/lib/query-keys";
import { useUserId } from "@/lib/stores/session-store";
import type { InvitesPage, InvitesResponse } from "@s3-viewer/types";
import { useQuery } from "@tanstack/react-query";

const PAGE_SIZE = MAX_PAGE_SIZE;

const pageInvites = (page: InvitesPage) => page.invites;

const usePagedInvites = (kind: "received" | "sent") => {
   const userId = useUserId();
   const { items: invites, ...pages } = useCursorQuery({
      queryKey:
         kind === "received"
            ? queryKeys.receivedInvites(userId)
            : queryKeys.sentInvitesAll(userId),
      queryFn: (cursor, signal) =>
         api.get<InvitesPage>(
            `${kind === "received" ? "/invites" : "/invites/sent"}${qs({ cursor, limit: PAGE_SIZE })}`,
            signal
         ),
      select: pageInvites,
      nextCursor: pageCursor,
      enabled: Boolean(userId),
   });
   return { ...pages, invites };
};

const useReceivedInvites = () => usePagedInvites("received");
const useAllSentInvites = () => usePagedInvites("sent");

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

export { useAllSentInvites, useReceivedInvites, useSentInvites };
export type { InvitesPage };
