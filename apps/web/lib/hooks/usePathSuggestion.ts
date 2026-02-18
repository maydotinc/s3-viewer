import useObjects from "@/lib/hooks/queries/s3/useObjects";
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

function usePathSuggestion(
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

  const keys = useObjects({ serverId, bucketName, prefix, partial });

  const suggestion = useMemo(() => {
    if (!currentKey || !partial || !debouncedKey) return "";
    const match = keys.find(
      (key) => key.startsWith(debouncedKey) && key !== debouncedKey
    );
    return match ? match.substring(debouncedKey.length) : "";
  }, [keys, currentKey, debouncedKey, partial]);

  return currentKey ? suggestion : "";
}

export default usePathSuggestion;