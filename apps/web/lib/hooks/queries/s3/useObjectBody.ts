import { queryKeys } from "@/lib/queryKeys";
import useSessionStore, { useUserId } from "@/lib/stores/sessionStore";
import { PRESIGN_EXPIRY_SECONDS, SECOND_MS } from "@s3-viewer/types";
import { useQuery } from "@tanstack/react-query";

const PRESIGN_STALE_MS = 0.8 * PRESIGN_EXPIRY_SECONDS * SECOND_MS;

/**
 * The object's own bytes as text, read straight from the presigned URL for a
 * viewer that has to parse the content (rather than hand it to an `iframe`).
 * The request is a cross-origin `fetch`, so a bucket without CORS rejects it —
 * callers must have something to fall back to.
 */
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
