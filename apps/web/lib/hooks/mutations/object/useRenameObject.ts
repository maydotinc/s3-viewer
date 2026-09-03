import { api, objectsPath } from "@/lib/api";
import useSessionStore, { useUserId } from "@/lib/stores/sessionStore";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { forgetObjects } from "./invalidate";

const useRenameObject = () => {
   const queryClient = useQueryClient();
   const userId = useUserId();
   const serverId = useSessionStore((state) => state.serverId);

   return useMutation({
      mutationFn: ({
         bucketName,
         objectKey,
         newObjectKey,
      }: {
         bucketName: string;
         objectKey: string;
         newObjectKey: string;
      }) =>
         api.post<void>(`${objectsPath(serverId, bucketName)}/rename`, {
            objectKey,
            newObjectKey,
         }),
      onSuccess: (_, { bucketName, objectKey }) => {
         forgetObjects(queryClient, userId, serverId, bucketName, [objectKey]);
      },
   });
};

export default useRenameObject;
