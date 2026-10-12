import { reachOf, type KnownReach } from "@/lib/utils/folder-access";
import useBucketsForServer from "./useBucketsForServer";

const useBucketScope = (
   userId: string,
   serverId: string,
   bucketName: string
): KnownReach => {
   const { buckets, isLoading } = useBucketsForServer(userId, serverId);
   if (isLoading) return undefined;
   return reachOf(buckets.find((bucket) => bucket.name === bucketName));
};

export default useBucketScope;
