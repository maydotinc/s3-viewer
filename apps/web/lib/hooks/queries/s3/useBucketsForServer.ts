import { useQuery } from "@tanstack/react-query";
import { bucketQueryOptions, NO_BUCKETS } from "./bucket-query";

const useBucketsForServer = (userId: string, serverId: string) => {
   const options = bucketQueryOptions(userId, serverId);
   const query = useQuery(options);
   return {
      buckets: query.data ?? NO_BUCKETS,
      isLoading: Boolean(options.enabled) && query.isPending,
      error: query.error,
      isFetching: query.isFetching,
      refetch: query.refetch,
   };
};

export default useBucketsForServer;
