import { api, serverInvitePath, type ApiError } from "@/lib/api";
import useApiMutation, {
   invalidateOn,
} from "@/lib/hooks/mutations/useApiMutation";
import { queryKeys } from "@/lib/query-keys";
import { toastError } from "@/lib/utils/toast";
import type { RevokeInviteInput } from "@s3-viewer/types";

const toastRevokeFailed = toastError("Couldn't revoke the invite");

const sentInvitesOf = ({
   variables: { serverId },
   scope,
}: {
   variables: RevokeInviteInput;
   scope: { userId: string };
}) => [queryKeys.sentInvites(scope.userId, serverId)];

const refreshGone = invalidateOn<ApiError, RevokeInviteInput>(
   404,
   sentInvitesOf
);

const useRevokeInvite = () =>
   useApiMutation<void, ApiError, RevokeInviteInput>({
      request: ({ serverId, inviteId }) =>
         api.delete<void>(serverInvitePath(serverId, inviteId)),
      success: "Invite revoked",
      invalidates: sentInvitesOf,
      failure: (failure) => {
         toastRevokeFailed(failure.error);
         refreshGone(failure);
      },
   });

export default useRevokeInvite;
