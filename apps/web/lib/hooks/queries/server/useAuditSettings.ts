import { api, field, serverPath } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { useUserId } from "@/lib/stores/session-store";
import type { AuditSettings } from "@s3-viewer/types";
import { useQuery } from "@tanstack/react-query";

const useAuditSettings = (serverId: string) => {
   const userId = useUserId();
   return useQuery({
      queryKey: queryKeys.auditSettings(userId, serverId),
      queryFn: ({ signal }) =>
         api
            .get<{
               settings: AuditSettings;
            }>(`${serverPath(serverId)}/audit/settings`, signal)
            .then(field("settings")),
      enabled: Boolean(userId && serverId),
   });
};

export default useAuditSettings;
