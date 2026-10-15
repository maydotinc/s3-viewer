import { objectsPath } from "@/lib/api";
import { runPrefixBatches } from "@/lib/utils/s3/batch";
import {
   OVERLAP_ERROR,
   destinationKey,
   prefixesOverlap,
} from "@/lib/utils/s3/keys";
import type { BucketTarget } from "@/lib/types";
import useObjectMutation, { forgetMatching } from "./object-mutation";
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
      settle: forgetMatching(
         ({ newPrefix }) =>
            (key) =>
               key.startsWith(newPrefix),
         ({ prefix, newPrefix }) =>
            (key) =>
               key.startsWith(prefix) && !key.startsWith(newPrefix)
      ),
   });

export default useMovePrefix;
export { movePrefix };
