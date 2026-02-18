import { createApiRequest } from "@/lib/utils/api";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

function useDebouncedValue(value: string, delay: number) {
   const [debounced, setDebounced] = useState(value);
   const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

   useEffect(() => {
      timerRef.current = setTimeout(() => setDebounced(value), delay);
      return () => {
         if (timerRef.current) clearTimeout(timerRef.current);
      };
   }, [value, delay]);

   return debounced;
}

export function usePathSuggestion(
   serverId: string,
   bucketName: string,
   currentKey: string
) {
   const debouncedKey = useDebouncedValue(currentKey, 200);

   const lastSlash = debouncedKey.lastIndexOf("/");
   const prefix =
      lastSlash >= 0 ? debouncedKey.substring(0, lastSlash + 1) : "";
   const partial =
      lastSlash >= 0 ? debouncedKey.substring(lastSlash + 1) : debouncedKey;

   const { data: keys = [] } = useQuery<string[]>({
      queryKey: ["path-suggestions", serverId, bucketName, prefix],
      queryFn: async () => {
         const params = new URLSearchParams({
            serverId,
            bucket: bucketName,
            blockSize: "100",
            ...(prefix && { prefix }),
         });
         const response = await createApiRequest(
            `/s3/object/list?${params.toString()}`
         );
         if (!response.ok) return [];
         const data = await response.json();
         return (data.objects || []).map((o: { Key: string }) => o.Key);
      },
      enabled: !!serverId && !!bucketName && !!partial,
      staleTime: 30_000,
   });

   const suggestion = useMemo(() => {
      if (!partial || !debouncedKey) return "";
      const match = keys.find(
         (key) => key.startsWith(debouncedKey) && key !== debouncedKey
      );
      return match ? match.substring(debouncedKey.length) : "";
   }, [keys, debouncedKey, partial]);

   return suggestion;
}
