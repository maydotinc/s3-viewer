import useObjectKeys, {
   type SuggestionScope,
} from "@/lib/hooks/queries/s3/useObjectKeys";
import { useEffect, useMemo, useState } from "react";

const useDebouncedValue = <T>(value: T, delayMs: number) => {
   const [debounced, setDebounced] = useState(value);
   useEffect(() => {
      const timer = setTimeout(() => setDebounced(value), delayMs);
      return () => clearTimeout(timer);
   }, [value, delayMs]);
   return debounced;
};

const isAcceptSuggestionKey = (
   event: React.KeyboardEvent<HTMLInputElement>
): boolean => {
   const { selectionStart, selectionEnd, value } = event.currentTarget;
   return (
      event.key === "ArrowRight" &&
      !event.shiftKey &&
      selectionStart === value.length &&
      selectionEnd === value.length
   );
};

const usePathSuggestion = (
   bucketName: string,
   currentKey: string,
   scope?: SuggestionScope
): string => {
   const debouncedKey = useDebouncedValue(currentKey, 200);
   const keys = useObjectKeys(
      bucketName,
      debouncedKey,
      debouncedKey.length > 0,
      scope
   );

   return useMemo(() => {
      if (!currentKey || currentKey !== debouncedKey) return "";
      const match = keys.find(
         (key) => key.startsWith(currentKey) && key !== currentKey
      );
      return match ? match.slice(currentKey.length) : "";
   }, [keys, currentKey, debouncedKey]);
};

export default usePathSuggestion;
export { isAcceptSuggestionKey };
