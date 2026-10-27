import { objectsPath } from "@/lib/api";
import { isBatchComplete, runPrefixBatches } from "@/lib/utils/s3/batch";
import {
   OVERLAP_ERROR,
   destinationKey,
   prefixesOverlap,
} from "@/lib/utils/s3/keys";
import type { BucketTarget } from "@/lib/types";
import useObjectMutation, { forgetMatching } from "./useObjectMutation";
import { moveObjects, reportMoveResult } from "./useMoveObjects";

type MovePrefixInput = BucketTarget & {
   prefix: string;
   newPrefix: string;
   signal?: AbortSignal;
   onProgress?: (moved: number) => void;
};

const movePrefix = async ({
   userId,
   serverId,
   bucketName,
   prefix,
   newPrefix,
   signal,
   onProgress,
}: MovePrefixInput) => {
   if (prefixesOverlap(prefix, newPrefix)) throw new Error(OVERLAP_ERROR);
   const path = objectsPath(serverId, bucketName);
   const source = { folderKey: prefix };
   return runPrefixBatches({
      path,
      prefix,
      signal,
      incomplete: "The folder move is incomplete.",
      run: (page) =>
         moveObjects(
            path,
            page.objects.map(({ key, expectedETag }) => ({
               key,
               newKey: destinationKey(key, source, newPrefix),
               expectedETag,
            })),
            userId,
            signal
         ),
      onProgress,
   });
};

const useMovePrefix = () =>
   useObjectMutation({
      mutationFn: movePrefix,
      onSuccess: reportMoveResult,
      settle: forgetMatching(({ prefix, newPrefix }, outcome) => {
         const landed = (key: string) => key.startsWith(newPrefix);
         const left = (key: string) => key.startsWith(prefix) && !landed(key);
         return outcome && isBatchComplete(outcome.data)
            ? { changed: landed, removed: left }
            : { changed: (key: string) => landed(key) || left(key) };
      }),
   });

export default useMovePrefix;
export { movePrefix };
