import { LIST_INPUT_DEBOUNCE_MS, LIST_INPUT_MIN_CHARS } from "@/lib/constants";
import {
   useBucketContext,
   useBucketFilter,
} from "@/components/Buckets/Context";
import { useGridPaginationContext } from "@/components/DataGrid/context";
import { FILTER_PADDING, FilterDecor } from "@/components/filter-input";
import PathInput from "@/components/path-input";
import { usePathSuggestion } from "@/lib/hooks/usePathSuggestion";
import { useShortcut } from "@/lib/shortcuts";
import { cn } from "@s3-viewer/ui/lib/utils";
import { useEffect, useId, useRef, useState } from "react";

const PrefixSearch = ({ className }: { className?: string }) => {
   const { bucketName, prefix } = useBucketContext();
   const { filter, setFilter } = useBucketFilter();
   const { gridReady } = useGridPaginationContext();
   const [text, setText] = useState(filter);
   const inputRef = useRef<HTMLInputElement>(null);
   const inputId = useId();
   const editable = gridReady || Boolean(text) || Boolean(filter);

   useEffect(() => {
      setText(filter);
   }, [filter]);

   useEffect(() => {
      // applying a filter lists the bucket, so a lone character waits for more input and drops a filter it no longer matches.
      const next = text.length < LIST_INPUT_MIN_CHARS ? "" : text;
      if (next === filter) return;
      const timer = setTimeout(() => setFilter(next), LIST_INPUT_DEBOUNCE_MS);
      return () => clearTimeout(timer);
   }, [text, filter, setFilter]);

   useShortcut({
      keys: "/",
      label: "Filter objects",
      group: "Objects",
      when: () => editable,
      handler: () => {
         inputRef.current?.focus();
         inputRef.current?.select();
      },
   });

   const suggestion = usePathSuggestion(
      bucketName,
      text ? `${prefix}${text}` : "",
      { cacheOnly: true }
   );

   return (
      <PathInput
         className={cn("flex h-9 items-center pointer-coarse:h-11", className)}
         sharedPaddingClassName={FILTER_PADDING}
         inputClassName="peer bg-transparent"
         id={inputId}
         ref={inputRef}
         type="text"
         disabled={!editable}
         placeholder="Filter by prefix…"
         value={text}
         suggestion={suggestion}
         acceptOnEnter
         onChange={(event) => setText(event.target.value)}
         onAccept={setText}
      >
         <FilterDecor
            inputId={inputId}
            label="Filter by prefix"
            shortcut={gridReady}
         />
      </PathInput>
   );
};

export default PrefixSearch;
