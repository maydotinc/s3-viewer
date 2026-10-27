import { objectsPath } from "@/lib/api";
import type { BucketTarget } from "@/lib/types";
import { isBatchComplete, runPrefixBatches } from "@/lib/utils/s3/batch";
import useObjectMutation, { forgetMatching } from "./useObjectMutation";
import { deleteObjects, reportDeleteResult } from "./useDeleteObjects";

type DeletePrefixInput = BucketTarget & {
   prefix: string;
   signal?: AbortSignal;
   onProgress?: (deleted: number) => void;
};

const deletePrefix = ({
   userId,
   serverId,
   bucketName,
   prefix,
   signal,
   onProgress,
}: DeletePrefixInput) => {
   const path = objectsPath(serverId, bucketName);
   return runPrefixBatches({
      path,
      prefix,
      signal,
      incomplete: "Folder deletion is incomplete.",
      run: (page) => deleteObjects(path, page.objects, userId, signal),
      onProgress,
   });
};

const useDeletePrefix = () =>
   useObjectMutation({
      mutationFn: deletePrefix,
      onSuccess: reportDeleteResult,
      settle: forgetMatching(({ prefix }, outcome) => {
         const under = (key: string) => key.startsWith(prefix);
         return outcome && isBatchComplete(outcome.data)
            ? { removed: under }
            : { changed: under };
      }),
   });

export { deletePrefix };
export default useDeletePrefix;
