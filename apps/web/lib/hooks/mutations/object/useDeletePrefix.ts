import { api, objectsPath, qs } from "@/lib/api";
import {
   MAX_BATCH_KEYS,
   MAX_BATCH_KEY_CHARS,
   chunkKeys,
   type S3DeleteResult,
   type S3KeysPage,
} from "@s3-viewer/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { forgetObjects } from "./invalidate";
import {
   addPage,
   emptySummary,
   reportDeleteResult,
   type DeleteSummary,
} from "./useDeleteObjects";

const DELETE_CONCURRENCY = 4;

type DeletePrefixInput = {
   userId: string;
   serverId: string;
   bucketName: string;
   prefix: string;
   signal?: AbortSignal;
   onProgress?: (deleted: number) => void;
};

const useDeletePrefix = () => {
   const queryClient = useQueryClient();

   const run = async ({
      serverId,
      bucketName,
      prefix,
      signal,
      onProgress,
   }: DeletePrefixInput): Promise<DeleteSummary> => {
      const path = objectsPath(serverId, bucketName);
      const own = new AbortController();
      const abort = signal ? AbortSignal.any([signal, own.signal]) : own.signal;
      const summary = emptySummary();
      const inFlight = new Set<Promise<void>>();
      let failure: unknown;
      let continuationToken: string | undefined;

      const deleteBatch = (objectKeys: string[]) => {
         const job: Promise<void> = api
            .delete<S3DeleteResult>(path, { objectKeys }, abort)
            .then((result) => {
               addPage(summary, result);
               onProgress?.(summary.deleted);
            })
            .catch((error: unknown) => {
               failure ??= error;
               own.abort();
            })
            .finally(() => inFlight.delete(job));
         inFlight.add(job);
      };

      do {
         const page = await api
            .get<S3KeysPage>(
               `${path}/keys${qs({ prefix, continuationToken })}`,
               abort
            )
            .catch((error: unknown) => {
               failure ??= error;
               own.abort();
               return { keys: [], nextToken: null } satisfies S3KeysPage;
            });
         continuationToken = page.nextToken ?? undefined;
         for (const batch of chunkKeys(
            page.keys,
            MAX_BATCH_KEYS,
            MAX_BATCH_KEY_CHARS
         )) {
            deleteBatch(batch);
            if (inFlight.size >= DELETE_CONCURRENCY)
               await Promise.race(inFlight);
         }
      } while (continuationToken && failure === undefined);
      await Promise.all(inFlight);
      if (failure !== undefined) throw failure;
      return summary;
   };

   return useMutation({
      mutationFn: run,
      onSuccess: reportDeleteResult,
      onSettled: (_result, _error, { userId, serverId, bucketName, prefix }) =>
         forgetObjects(queryClient, userId, serverId, bucketName, (key) =>
            key.startsWith(prefix)
         ),
   });
};

export default useDeletePrefix;
