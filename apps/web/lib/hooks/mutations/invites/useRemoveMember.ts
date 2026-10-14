import { api, memberPath, type ApiError } from "@/lib/api";
import useApiMutation from "@/lib/hooks/mutations/useApiMutation";
import { queryKeys } from "@/lib/query-keys";
import { RemoveMemberInput } from "@s3-viewer/types";

const useRemoveMember = () =>
   useApiMutation<void, ApiError, RemoveMemberInput>({
      request: ({ serverId, userId: memberId }) =>
         api.delete<void>(memberPath(serverId, memberId)),
      success: "Member removed",
      invalidates: ({ variables: { serverId }, scope }) => [
         queryKeys.members(scope.userId, serverId),
         queryKeys.sentInvites(scope.userId, serverId),
      ],
      failure: "Couldn't remove the member",
   });

export default useRemoveMember;
