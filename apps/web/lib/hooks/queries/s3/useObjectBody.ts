import { queryKeys } from "@/lib/queryKeys";
import useSessionStore, { useUserId } from "@/lib/stores/sessionStore";
import { PRESIGN_EXPIRY_SECONDS, SECOND_MS } from "@s3-viewer/types";
import { useQuery } from "@tanstack/react-query";

const PRESIGN_STALE_MS = 0.8 * PRESIGN_EXPIRY_SECONDS * SECOND_MS;

// a cross-origin `fetch` on the presigned url, so a bucket without cors
// rejects it — callers must have something to fall back to.
const useObjectBody = (
   bucketName: string,
   objectKey: string,
   url: string | undefined,
   enabled = true
) => {
   const userId = useUserId();
   const serverId = useSessionStore((state) => state.serverId);

   return useQuery({
      queryKey: queryKeys.objectPreviewBody(
         userId,
         serverId,
         bucketName,
         objectKey
      ),
      queryFn: async ({ signal }) => {
         const response = await fetch(url ?? "", { signal });
         if (!response.ok)
            throw new Error(
               `The object couldn't be read (${response.status}).`
            );
         return response.text();
      },
      enabled: Boolean(enabled && url && userId && serverId && objectKey),
      staleTime: PRESIGN_STALE_MS,
      gcTime: PRESIGN_STALE_MS,
      refetchOnWindowFocus: false,
      retry: false,
   });
};

export default useObjectBody;
