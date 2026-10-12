import { api, field, serverPath } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { S3Bucket } from "@s3-viewer/types";
import { queryOptions } from "@tanstack/react-query";

const NO_BUCKETS: S3Bucket[] = [];

const bucketQueryOptions = (userId: string, serverId: string) =>
   queryOptions({
      queryKey: queryKeys.buckets(userId, serverId),
      queryFn: ({ signal }) =>
         api
            .get<{
               buckets: S3Bucket[];
            }>(`${serverPath(serverId)}/buckets`, signal)
            .then(field("buckets")),
      enabled: Boolean(userId && serverId),
   });

export { bucketQueryOptions, NO_BUCKETS };
