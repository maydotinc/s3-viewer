import { ApiError, api, memberPath } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useUserId } from "@/lib/stores/sessionStore";
import { toastError } from "@/lib/utils/toast";
import { ServerUser, UpdateRoleInput } from "@s3-viewer/types";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useUpdateRole = () => {
   const queryClient = useQueryClient();
   const userId = useUserId();

   return useMutation<ServerUser, ApiError, UpdateRoleInput>({
      mutationFn: async ({ serverId, userId: memberId, ...body }) =>
         (
            await api.patch<{ member: ServerUser }>(
               memberPath(serverId, memberId),
               body
            )
         ).member,
      onSuccess: (_member, { serverId }) => {
         toast.success("Access updated");
         queryClient.invalidateQueries({
            queryKey: queryKeys.members(userId, serverId),
         });
      },
      onError: toastError("Couldn't update access"),
   });
};

export default useUpdateRole;
