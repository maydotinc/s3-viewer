import { api, field, serverPath, type ApiError } from "@/lib/api";
import useApiMutation from "@/lib/hooks/mutations/useApiMutation";
import { firstPageOnly } from "@/lib/hooks/queries/server/useAuditLog";
import { queryKeys } from "@/lib/query-keys";
import { toastError } from "@/lib/utils/toast";
import {
   ErrorCode,
   type AuditSettings,
   type AuditSettingsInput,
} from "@s3-viewer/types";
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
         queryClient.setQueriesData(
            { queryKey: queryKeys.auditLogs(scope.userId, serverId) },
            firstPageOnly
         );
      },
      invalidates: ({ variables: { serverId }, scope }) => [
         queryKeys.servers(scope.userId),
         queryKeys.auditLogs(scope.userId, serverId),
      ],
      // the form asks for a fresh sign-in itself.
      failure: ({ error }) => {
         if (error.code !== ErrorCode.SESSION_STALE)
            toastError("Couldn't save audit log settings")(error);
      },
   });

export default useUpdateAuditSettings;
