import { useSessionScope } from "@/lib/stores/session-scope";
import useBucketsForServer from "./useBucketsForServer";

const useBuckets = (bucketName?: string) => {
   const { userId, serverId } = useSessionScope();
   const query = useBucketsForServer(userId, serverId);
   const { buckets } = query;
   const currentBucket = bucketName
      ? buckets.find((bucket) => bucket.name === bucketName)
      : undefined;

   return {
      buckets,
      currentBucket,
      isBucketsLoading: query.isLoading,
      bucketsError: query.error,
      isFetching: query.isFetching,
      refetch: query.refetch,
   };
};

export default useBuckets;
