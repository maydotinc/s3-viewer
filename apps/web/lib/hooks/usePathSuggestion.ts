import { LIST_INPUT_DEBOUNCE_MS, LIST_INPUT_MIN_CHARS } from "@/lib/constants";
import { useDebouncedValue } from "./useDebouncedValue";
import useObjectKeys, {
   type SuggestionScope,
} from "@/lib/hooks/queries/s3/useObjectKeys";
import { useMemo } from "react";

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

type PathSuggestionOptions = {
   scope?: SuggestionScope;
   foldersOnly?: boolean;
   cacheOnly?: boolean;
};

const usePathSuggestion = (
   bucketName: string,
   currentKey: string,
   { scope, foldersOnly = false, cacheOnly = false }: PathSuggestionOptions = {}
): string => {
   const debouncedKey = useDebouncedValue(currentKey, LIST_INPUT_DEBOUNCE_MS);
   const keys = useObjectKeys(
      bucketName,
      debouncedKey,
      debouncedKey.length >= LIST_INPUT_MIN_CHARS,
      scope,
      cacheOnly
   );

   return useMemo(() => {
      if (!currentKey || currentKey !== debouncedKey) return "";
      const match = keys.find(
         (key) =>
            key.startsWith(currentKey) &&
            key !== currentKey &&
            (!foldersOnly || key.endsWith("/"))
      );
      return match ? match.slice(currentKey.length) : "";
   }, [keys, currentKey, debouncedKey, foldersOnly]);
};

export { isAcceptSuggestionKey, usePathSuggestion };
