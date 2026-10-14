import { api, type ApiError } from "@/lib/api";
import useApiMutation from "@/lib/hooks/mutations/useApiMutation";
import { queryKeys } from "@/lib/query-keys";
import type { SendInvitesInput, SendInvitesResult } from "@s3-viewer/types";

// the wizard renders both the result and any failure in the page, so neither side toasts
const useSendInvites = () =>
   useApiMutation<SendInvitesResult, ApiError, SendInvitesInput>({
      request: (body) => api.post<SendInvitesResult>("/invites", body),
      invalidates: ({ variables: { targets }, scope }) =>
         targets.map(({ serverId }) =>
            queryKeys.sentInvites(scope.userId, serverId)
         ),
      failure: () => {},
   });

export default useSendInvites;
