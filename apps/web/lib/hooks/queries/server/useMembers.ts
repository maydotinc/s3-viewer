import { api, serverPath } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useUserId } from "@/lib/stores/sessionStore";
import { ServerUser } from "@s3-viewer/types";
import { useQuery } from "@tanstack/react-query";

// shared instance: an inline `= []` default would be a new array every render
// and re-trigger every memo and effect depending on it.
const NO_MEMBERS: ServerUser[] = [];

const useMembers = (serverId: string) => {
   const userId = useUserId();

   const {
      data: members = NO_MEMBERS,
      isLoading,
      error,
      dataUpdatedAt,
   } = useQuery({
      queryKey: queryKeys.members(userId, serverId),
      queryFn: async () =>
         (
            await api.get<{ members: ServerUser[] }>(
               `${serverPath(serverId)}/members`
            )
         ).members,
      enabled: Boolean(userId && serverId),
   });

   return { members, isLoading, error, dataUpdatedAt };
};

export default useMembers;
