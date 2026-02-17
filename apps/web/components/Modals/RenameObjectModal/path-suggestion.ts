import { createApiRequest } from "@/lib/utils/api";
import { useCallback, useEffect, useRef, useState } from "react";

export function usePathSuggestion(
   serverId: string,
   bucketName: string,
   currentKey: string
) {
   const [suggestion, setSuggestion] = useState("");
   const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
   const cacheRef = useRef<Map<string, string[]>>(new Map());

   const fetchSuggestions = useCallback(
      async (prefix: string): Promise<string[]> => {
         const cacheKey = `${serverId}:${bucketName}:${prefix}`;
         if (cacheRef.current.has(cacheKey)) {
            return cacheRef.current.get(cacheKey)!;
         }

         try {
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
            const keys: string[] = (data.objects || []).map(
               (o: { Key: string }) => o.Key
            );
            cacheRef.current.set(cacheKey, keys);
            return keys;
         } catch {
            return [];
         }
      },
      [serverId, bucketName]
   );

   useEffect(() => {
      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (!currentKey) {
         setSuggestion("");
         return;
      }

      debounceRef.current = setTimeout(async () => {
         const lastSlash = currentKey.lastIndexOf("/");
         const prefix =
            lastSlash >= 0 ? currentKey.substring(0, lastSlash + 1) : "";
         const partial =
            lastSlash >= 0
               ? currentKey.substring(lastSlash + 1)
               : currentKey;

         if (!partial) {
            setSuggestion("");
            return;
         }

         const keys = await fetchSuggestions(prefix);
         const match = keys.find(
            (key) => key.startsWith(currentKey) && key !== currentKey
         );

         if (match) {
            setSuggestion(match.substring(currentKey.length));
         } else {
            setSuggestion("");
         }
      }, 200);

      return () => {
         if (debounceRef.current) clearTimeout(debounceRef.current);
      };
   }, [currentKey, fetchSuggestions]);

   return suggestion;
}
