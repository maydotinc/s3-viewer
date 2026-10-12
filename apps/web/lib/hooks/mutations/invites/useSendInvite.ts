import { api, isAborted, serverPath, type ApiError } from "@/lib/api";
import useApiMutation from "@/lib/hooks/mutations/useApiMutation";
import { queryKeys } from "@/lib/query-keys";
import { toastError } from "@/lib/utils/toast";
import { ErrorCode, SendInviteInput, SendInviteResult } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";

const toastSendFailed = toastError("Couldn't send invites");

const useSendInvite = () =>
   useApiMutation<SendInviteResult, ApiError, SendInviteInput>({
      request: async ({ serverId, ...body }) => {
         const { invites, alreadyMembers = [] } = await api.post<
            Partial<SendInviteResult>
         >(`${serverPath(serverId)}/invites`, body);
         return { invites: invites ?? [], alreadyMembers };
      },
      success: ({ data: { invites, alreadyMembers } }) => {
         const emailed = invites.filter(
            ({ emailed }) => emailed !== false
         ).length;
         if (emailed > 0)
            toast.success(
               emailed === 1 ? "Invite sent" : `${emailed} invites sent`
            );
         if (alreadyMembers.length > 0) {
            toast.info(
               alreadyMembers.length === 1
                  ? `${alreadyMembers[0]} is already a member`
                  : `${alreadyMembers.length} of those people are already members`
            );
         }
      },
      invalidates: ({ variables: { serverId }, scope }) =>
         queryKeys.sentInviteScopes(scope.userId, serverId),
      failure: ({ error }) => {
         if (isAborted(error) || error.code === ErrorCode.EMAIL_UNVERIFIED) {
            return;
         }
         toastSendFailed(error);
      },
   });

export default useSendInvite;
