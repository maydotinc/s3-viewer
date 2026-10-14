import { api, field, memberPath, type ApiError } from "@/lib/api";
import useApiMutation, {
   invalidateOn,
} from "@/lib/hooks/mutations/useApiMutation";
import { queryKeys } from "@/lib/query-keys";
import { toastError } from "@/lib/utils/toast";
import { ServerUser, UpdateRoleInput } from "@s3-viewer/types";

const toastUpdateFailed = toastError("Couldn't update access");

const refreshChanged = invalidateOn<ApiError, UpdateRoleInput>(
   409,
   ({ variables, scope }) => [
      queryKeys.members(scope.userId, variables.serverId),
   ]
);

const useUpdateRole = () =>
   useApiMutation<ServerUser, ApiError, UpdateRoleInput>({
      request: ({ serverId, userId: memberId, ...body }) =>
         api
            .patch<{ member: ServerUser }>(memberPath(serverId, memberId), body)
            .then(field("member")),
      success: "Access updated",
      invalidates: ({ variables: { serverId }, scope }) => [
         queryKeys.members(scope.userId, serverId),
         queryKeys.sentInvites(scope.userId, serverId),
      ],
      failure: (failure) => {
         refreshChanged(failure);
         if (failure.error.status !== 409 || !failure.variables.bucketAccess)
            toastUpdateFailed(failure.error);
      },
   });

export default useUpdateRole;
