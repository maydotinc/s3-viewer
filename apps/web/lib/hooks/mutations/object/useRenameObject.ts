import { api, objectsPath } from "@/lib/api";
import { OBJECT_MUTATION_PATH } from "@s3-viewer/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { forgetKeys } from "./invalidate";

const useRenameObject = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: ({
         userId,
         serverId,
         bucketName,
         objectKey,
         newObjectKey,
         expectedETag,
      }: {
         userId: string;
         serverId: string;
         bucketName: string;
         objectKey: string;
         newObjectKey: string;
         expectedETag: string;
      }) =>
         api.post<void>(
            `${objectsPath(serverId, bucketName)}${OBJECT_MUTATION_PATH}/rename`,
            {
               expectedUserId: userId,
               objectKey,
               newObjectKey,
               expectedETag,
            }
         ),
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
