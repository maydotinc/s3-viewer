import { api, serverPath } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useUserId } from "@/lib/stores/sessionStore";
import { ServerInvite } from "@s3-viewer/types";
import { useQuery } from "@tanstack/react-query";

type InvitesResponse = { invites: ServerInvite[] };

/** Invites addressed to the signed-in user (unexpired). */
const useReceivedInvites = () => {
   const userId = useUserId();
   return useQuery({
      queryKey: queryKeys.receivedInvites(userId),
      queryFn: async () => (await api.get<InvitesResponse>("/invites")).invites,
      enabled: Boolean(userId),
   });
};

/** Pending invites on one server (needs MANAGE_MEMBERS there). */
const useSentInvites = (serverId: string) => {
   const userId = useUserId();
   return useQuery({
      queryKey: queryKeys.sentInvites(userId, serverId),
      queryFn: async () =>
         (await api.get<InvitesResponse>(`${serverPath(serverId)}/invites`))
            .invites,
      enabled: Boolean(userId && serverId),
   });
};

/** Every invite the signed-in user sent, across all their servers. */
const useAllSentInvites = () => {
   const userId = useUserId();
   return useQuery({
      queryKey: queryKeys.sentInvitesAll(userId),
      queryFn: async () =>
         (await api.get<InvitesResponse>("/invites/sent")).invites,
      enabled: Boolean(userId),
   });
};

export { useAllSentInvites, useReceivedInvites, useSentInvites };
