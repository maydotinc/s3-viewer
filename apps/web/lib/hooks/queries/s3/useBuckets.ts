import useSessionStore from "@/lib/stores/sessionStore";
import { createApiRequest, handleApiError } from "@/lib/utils/api";
import { authClient } from "@s3-viewer/auth/client";
import { Bucket } from "@s3-viewer/types";
import { QueryFunctionContext, useQuery } from "@tanstack/react-query";

const useBuckets = (serverId?: string) => {
   const { data: session, isPending: isSessionPending } =
      authClient.useSession();
   const sessionServerId = useSessionStore((state) => state.serverId);
   const currentServerId = serverId || sessionServerId;

   const {
      data: buckets = [],
      isPending: isBucketsLoading,
      error: bucketsError,
      refetch,
   } = useQuery<Bucket[]>({
      queryKey: ["buckets", currentServerId],
      queryFn: async ({
         queryKey,
         signal,
      }: QueryFunctionContext): Promise<Bucket[]> => {
         const [, serverId] = queryKey as [string, string];
         const response = await createApiRequest(
            `/s3/bucket/list?serverId=${serverId}`,
            { signal }
         );

         if (!response.ok) {
            await handleApiError(response);
         }

         const { buckets } = (await response.json()) as {
            buckets: Bucket[];
         };
         return buckets;
      },
      enabled: !isSessionPending && !!session?.user && !!currentServerId,
   });

   return {
      buckets,
      isBucketsLoading,
      bucketsError,
      refetch,
   };
};

export default useBuckets;
