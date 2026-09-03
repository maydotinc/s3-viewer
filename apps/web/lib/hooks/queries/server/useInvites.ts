import { api, serverPath } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useUserId } from "@/lib/stores/sessionStore";
import { ServerInvite } from "@s3-viewer/types";
import { useQuery } from "@tanstack/react-query";

type InvitesResponse = { invites: ServerInvite[] };

const useReceivedInvites = () => {
   const userId = useUserId();
   return useQuery({
      queryKey: queryKeys.receivedInvites(userId),
      queryFn: async () => (await api.get<InvitesResponse>("/invites")).invites,
      enabled: Boolean(userId),
   });
};

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

export { useReceivedInvites, useSentInvites };
