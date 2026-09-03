import { useBucketContext } from "@/components/Buckets/Context";
import { useGridContext } from "@/components/DataGrid/context";
import usePathSuggestion, {
   isAcceptSuggestionKey,
} from "@/lib/hooks/usePathSuggestion";
import { cn } from "@s3-viewer/ui/lib/utils";
import { Search } from "lucide-react";
import { useEffect, useId, useState } from "react";

const DEBOUNCE_MS = 300;

const PrefixSearch = ({ className }: { className?: string }) => {
   const { bucketName, prefix, filter, setFilter } = useBucketContext();
   const { gridReady } = useGridContext();
   const [text, setText] = useState(filter);
   const inputId = useId();

   useEffect(() => {
      setText(filter);
   }, [filter]);

   useEffect(() => {
      if (text === filter) return;
      const timer = setTimeout(() => setFilter(text), DEBOUNCE_MS);
      return () => clearTimeout(timer);
   }, [text, filter, setFilter]);

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
      <div className={cn("relative flex items-center", className)}>
         <label htmlFor={inputId} className="sr-only">
            Filter by prefix
         </label>
         <Search
            className="pointer-events-none absolute left-3 z-10 size-4 text-viewerlighttext"
            aria-hidden="true"
         />
         <input
            id={inputId}
            type="text"
            disabled={!gridReady}
            placeholder="Filter by prefix…"
            value={text}
            onChange={(event) => setText(event.target.value)}
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
            className="h-9 w-full min-w-0 rounded-lg border border-viewerborder bg-transparent py-1 pl-9 pr-3 text-sm text-viewerblack outline-none placeholder:text-viewerlighttext focus-visible:ring-[3px] focus-visible:ring-viewerblue/40 disabled:cursor-not-allowed disabled:opacity-50"
         />
         {suggestion && (
            <div
               aria-hidden="true"
               className="pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre pl-9 pr-3 text-sm"
            >
               <span className="invisible">{text}</span>
               <span className="text-viewerlighttext">{suggestion}</span>
            </div>
         )}
      </div>
   );
};

export default PrefixSearch;
