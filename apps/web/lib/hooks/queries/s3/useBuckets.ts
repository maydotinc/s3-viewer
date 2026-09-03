import { api, serverPath } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import useSessionStore, { useUserId } from "@/lib/stores/sessionStore";
import type { S3Bucket } from "@s3-viewer/types";
import { useQuery } from "@tanstack/react-query";

const useBuckets = (bucketName?: string) => {
   const userId = useUserId();
   const serverId = useSessionStore((state) => state.serverId);
   const enabled = Boolean(userId && serverId);

   const query = useQuery({
      queryKey: queryKeys.buckets(userId, serverId),
      queryFn: async () => {
         const { buckets } = await api.get<{ buckets: S3Bucket[] }>(
            `${serverPath(serverId)}/buckets`
         );
         return buckets;
      },
      enabled,
   });

   const buckets = query.data ?? [];
   const currentBucket = bucketName
      ? buckets.find((bucket) => bucket.name === bucketName)
      : undefined;

   return {
      buckets,
      currentBucket,
      isBucketsLoading: enabled && query.isPending,
      bucketsError: query.error,
      isFetching: query.isFetching,
      refetch: query.refetch,
   };
};

export default useBuckets;
