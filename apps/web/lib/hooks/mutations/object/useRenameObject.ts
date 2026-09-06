import { api, objectsPath } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { forgetKeys } from "./invalidate";

const useRenameObject = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: ({
         serverId,
         bucketName,
         objectKey,
         newObjectKey,
      }: {
         userId: string;
         serverId: string;
         bucketName: string;
         objectKey: string;
         newObjectKey: string;
      }) =>
         api.post<void>(`${objectsPath(serverId, bucketName)}/rename`, {
            objectKey,
            newObjectKey,
         }),
      onSettled: (
         _result,
         _error,
         { userId, serverId, bucketName, objectKey, newObjectKey }
      ) => {
         forgetKeys(queryClient, userId, serverId, bucketName, [
            objectKey,
            newObjectKey,
         ]);
      },
   });
};

export default useRenameObject;
