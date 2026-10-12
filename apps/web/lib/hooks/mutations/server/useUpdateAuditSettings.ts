import { api, field, serverPath, type ApiError } from "@/lib/api";
import useApiMutation from "@/lib/hooks/mutations/useApiMutation";
import { queryKeys } from "@/lib/query-keys";
import type { AuditSettings, AuditSettingsInput } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";

const useUpdateAuditSettings = () =>
   useApiMutation<AuditSettings, ApiError, AuditSettingsInput>({
      request: ({ serverId, ...settings }) =>
         api
            .patch<{
               settings: AuditSettings;
            }>(`${serverPath(serverId)}/audit/settings`, settings)
            .then(field("settings")),
      success: ({ data, variables: { serverId }, scope, queryClient }) => {
         toast.success("Audit log settings saved");
         queryClient.setQueryData(
            queryKeys.auditSettings(scope.userId, serverId),
            data
         );
      },
      invalidates: ({ variables: { serverId }, scope }) => [
         queryKeys.servers(scope.userId),
         queryKeys.auditLog(scope.userId, serverId),
      ],
      failure: "Couldn't save audit log settings",
   });

export default useUpdateAuditSettings;
