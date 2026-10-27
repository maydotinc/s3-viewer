import { SEARCH_DEBOUNCE_MS } from "@/lib/constants";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { queryKeys } from "@/lib/query-keys";
import { useUserId } from "@/lib/stores/session-store";
import { textDigest } from "@/lib/utils/digest";
import { checkUploadConflicts } from "@/lib/utils/s3/upload-preflight";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

const useTransferPreflight = (
   serverId: string,
   bucketName: string,
   objectKeys: readonly string[],
   enabled: boolean
) => {
   const userId = useUserId();
   const keys = useDebouncedValue(objectKeys.join("\n"), SEARCH_DEBOUNCE_MS);
   const digest = useMemo(() => textDigest(keys), [keys]);
   const ready = enabled && Boolean(userId && serverId && bucketName && keys);

   const query = useQuery({
      queryKey: [
         ...queryKeys.bucket(userId, serverId, bucketName),
         "transfer-preflight",
         digest,
      ] as const,
      queryFn: ({ signal }) =>
         checkUploadConflicts({
            serverId,
            bucketName,
            keys: keys.split("\n"),
            signal,
         }),
      enabled: ready,
      // objects may appear or vanish at the destination between opens; always re-check
      staleTime: 0,
      gcTime: 0,
      retry: false,
      refetchOnWindowFocus: false,
   });

   return {
      existing: query.data?.existing.length ?? 0,
      total: keys ? keys.split("\n").length : 0,
      isChecking: ready && query.isFetching,
      isReady: ready && query.isSuccess && !query.isFetching,
   };
};

export default useTransferPreflight;
