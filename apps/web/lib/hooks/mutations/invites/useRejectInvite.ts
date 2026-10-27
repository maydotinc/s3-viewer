import { api, invitePath, type ApiError } from "@/lib/api";
import useApiMutation from "@/lib/hooks/mutations/useApiMutation";
import { queryKeys } from "@/lib/query-keys";
import { InviteIdInput } from "@s3-viewer/shared";

const useRejectInvite = () =>
   useApiMutation<void, ApiError, InviteIdInput>({
      request: ({ inviteId }) =>
         api.post<void>(`${invitePath(inviteId)}/reject`),
      success: "Invite declined",
      invalidates: ({ scope }) => [queryKeys.receivedInvites(scope.userId)],
      failure: "Couldn't decline the invite",
   });

export default useRejectInvite;
