import { api, errorMessage, isAborted, objectsPath, qs } from "@/lib/api";
import type { S3KeysPage } from "@s3-viewer/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { forgetObjects } from "./invalidate";
import {
   addPage,
   deleteObjects,
   emptySummary,
   reportDeleteResult,
   type DeleteSummary,
} from "./useDeleteObjects";

type DeletePrefixInput = {
   userId: string;
   serverId: string;
   bucketName: string;
   prefix: string;
   signal?: AbortSignal;
   onProgress?: (deleted: number) => void;
};

const deletePrefix = async ({
   userId,
   serverId,
   bucketName,
   prefix,
   signal,
   onProgress,
}: DeletePrefixInput): Promise<DeleteSummary> => {
   const path = objectsPath(serverId, bucketName);
   const summary = emptySummary();
   const tokens = new Set<string>();
   let continuationToken: string | undefined;
   do {
      let page: S3KeysPage;
      try {
         page = await api.get<S3KeysPage>(
            `${path}/keys${qs({ prefix, continuationToken })}`,
            signal
         );
         if (page.nextToken && tokens.has(page.nextToken))
            throw new Error("Storage repeated a folder listing page.");
         if (page.objects.some(({ key }) => !key.startsWith(prefix)))
            throw new Error("Storage returned an object outside this folder.");
      } catch (error) {
         if (isAborted(error)) throw error;
         summary.listingError = `${errorMessage(error)} Folder deletion is incomplete. Close this dialog and refresh before trying again.`;
         break;
      }
      if (page.nextToken) tokens.add(page.nextToken);
      continuationToken = page.nextToken ?? undefined;
      addPage(summary, await deleteObjects(path, page.objects, userId, signal));
      onProgress?.(summary.deleted);
   } while (continuationToken);
   return summary;
};

const useDeletePrefix = () => {
   const queryClient = useQueryClient();
   return useMutation({
      mutationFn: deletePrefix,
      onSuccess: reportDeleteResult,
      onSettled: (_result, _error, { userId, serverId, bucketName, prefix }) =>
         forgetObjects(queryClient, userId, serverId, bucketName, (key) =>
            key.startsWith(prefix)
         ),
   });
};

export { deletePrefix };
export default useDeletePrefix;
