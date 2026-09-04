import {
   useBucketContext,
   useBucketFilter,
} from "@/components/Buckets/Context";
import { useGridPaginationContext } from "@/components/DataGrid/context";
import usePathSuggestion, {
   isAcceptSuggestionKey,
} from "@/lib/hooks/usePathSuggestion";
import { useShortcut } from "@/lib/shortcuts";
import { Kbd } from "@s3-viewer/ui/components/kbd";
import { cn } from "@s3-viewer/ui/lib/utils";
import { Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

const DEBOUNCE_MS = 300;

const PrefixSearch = ({ className }: { className?: string }) => {
   const { bucketName, prefix } = useBucketContext();
   const { filter, setFilter } = useBucketFilter();
   const { gridReady } = useGridPaginationContext();
   const [text, setText] = useState(filter);
   const [focused, setFocused] = useState(false);
   const inputRef = useRef<HTMLInputElement>(null);
   const inputId = useId();

   useEffect(() => {
      setText(filter);
   }, [filter]);

   useEffect(() => {
      if (text === filter) return;
      const timer = setTimeout(() => setFilter(text), DEBOUNCE_MS);
      return () => clearTimeout(timer);
   }, [text, filter, setFilter]);

   useShortcut({
      keys: "/",
      label: "Filter objects",
      group: "Objects",
      when: () => gridReady,
      handler: () => {
         inputRef.current?.focus();
         inputRef.current?.select();
      },
   });

   const suggestion = usePathSuggestion(
      bucketName,
      text ? `${prefix}${text}` : ""
   );

   const acceptSuggestion = () => {
      if (!suggestion) return;
      const slash = suggestion.indexOf("/");
      setText(
         text + (slash >= 0 ? suggestion.slice(0, slash + 1) : suggestion)
      );
   };

   return (
      <div className={cn("relative flex h-9 items-center", className)}>
         <label htmlFor={inputId} className="sr-only">
            Filter by prefix
         </label>
         <Search
            className="pointer-events-none absolute left-3 z-10 size-4 shrink-0 text-viewerlighttext"
            aria-hidden="true"
         />
         <input
            id={inputId}
            ref={inputRef}
            type="text"
            disabled={!gridReady}
            placeholder="Filter by prefix…"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(event) => {
               if (
                  suggestion &&
                  (event.key === "Enter" || isAcceptSuggestionKey(event))
               ) {
                  event.preventDefault();
                  acceptSuggestion();
               }
            }}
            autoComplete="off"
            spellCheck={false}
            className="h-9 w-full min-w-0 rounded-lg border border-viewerborder bg-transparent py-1 pl-9 pr-9 text-sm text-viewerblack outline-none placeholder:text-viewerlighttext focus-visible:border-viewerblue disabled:cursor-not-allowed disabled:opacity-50"
         />
         {suggestion && (
            <div
               aria-hidden="true"
               className="pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre pl-9 pr-9 text-sm"
            >
               <span className="invisible">{text}</span>
               <span className="text-viewerlighttext">{suggestion}</span>
            </div>
         )}
         {gridReady && !focused && !text && (
            <Kbd
               keys="/"
               className="pointer-events-none absolute right-3"
               aria-hidden="true"
            />
         )}
      </div>
   );
};

export default PrefixSearch;
