import { api, field, invitePath, type ApiError } from "@/lib/api";
import useApiMutation, {
   invalidateOn,
} from "@/lib/hooks/mutations/useApiMutation";
import { queryKeys } from "@/lib/query-keys";
import { toastError } from "@/lib/utils/toast";
import { InviteIdInput, ServerInfo } from "@s3-viewer/shared";
import { toast } from "@s3-viewer/ui/components/toast";

const toastAcceptFailed = toastError("Couldn't accept the invite");

const refreshTaken = invalidateOn<ApiError, InviteIdInput>(409, ({ scope }) => [
   queryKeys.receivedInvites(scope.userId),
]);

const useAcceptInvite = () =>
   useApiMutation<ServerInfo, ApiError, InviteIdInput>({
      request: ({ inviteId }) =>
         api
            .post<{ server: ServerInfo }>(`${invitePath(inviteId)}/accept`)
            .then(field("server")),
      success: ({ data }) => toast.success(`Joined ${data.name}`),
      invalidates: ({ data, scope }) => [
         queryKeys.receivedInvites(scope.userId),
         queryKeys.servers(scope.userId),
         queryKeys.server(scope.userId, data.id),
      ],
      failure: (failure) => {
         toastAcceptFailed(failure.error);
         refreshTaken(failure);
      },
   });

export default useAcceptInvite;
