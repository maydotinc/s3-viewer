import {
   NO_BUCKETS,
   bucketQueryOptions,
} from "@/lib/hooks/queries/s3/bucket-query";
import type { S3Bucket } from "@s3-viewer/types";
import { useQueries, type UseQueryResult } from "@tanstack/react-query";
import { useCallback } from "react";

type ServerBuckets = {
   serverId: string;
   buckets: S3Bucket[];
   isLoading: boolean;
   error: Error | null;
   isFetching: boolean;
   refetch: () => void;
};

// subscribes to every selected server's buckets at once, so switching sections never waits
const useServerBuckets = (
   userId: string,
   serverIds: readonly string[]
): ServerBuckets[] => {
   // the observer memoises a stable combine on its previous result, so a changed id list
   // would get the old array (wrong length) for one render; closing over the list forces a recompute
   const combine = useCallback(
      (results: UseQueryResult<S3Bucket[], Error>[]): ServerBuckets[] =>
         results.map((result, index) => ({
            serverId: serverIds[index]!,
            buckets: result.data ?? NO_BUCKETS,
            isLoading: result.isPending,
            error: result.error,
            isFetching: result.isFetching,
            refetch: result.refetch,
         })),
      [serverIds]
   );
   return useQueries({
      queries: serverIds.map((serverId) =>
         bucketQueryOptions(userId, serverId)
      ),
      combine,
   });
};

export default useServerBuckets;
export type { ServerBuckets };
