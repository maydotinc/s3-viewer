import { useBucketContext } from "@/components/Buckets/Context";
import useSessionStore from "@/lib/stores/sessionStore";
import { cn } from "@s3-viewer/ui/lib/utils";
import { debounce } from "lodash";
import { Search as SearchIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useGridContext } from "../context";
import usePathSuggestion from "@/lib/hooks/usePathSuggestion";

type PrefixSearchProps = {
   className?: string;
};

const PrefixSearch = ({ className }: PrefixSearchProps) => {
   const { gridRef, gridReady } = useGridContext();
   const { path, bucket } = useBucketContext();
   const serverId = useSessionStore((state) => state.serverId);
   const [searchText, setSearchText] = useState("");

   const fullKey = useMemo(() => {
      if (!searchText) return "";
      return path.length > 0
         ? path.join("/") + "/" + searchText
         : searchText;
   }, [searchText, path]);

   const suggestion = usePathSuggestion(
      serverId,
      bucket?.Name ?? "",
      fullKey
   );

   const handlePrefixSearch = useCallback(
      (value: string) => {
         if (value.includes("/")) {
            value = value.split("/")[0] ?? "";
         }
         gridRef.current?.api.setFilterModel({
            Key: {
               filterType: "text",
               type: "startsWith",
               filter: value,
            },
         });
      },
      [gridRef]
   );

   const debouncedPrefixSearch = useMemo(
      () => debounce(handlePrefixSearch, 500),
      [handlePrefixSearch]
   );

   useEffect(() => {
      return () => {
         debouncedPrefixSearch.cancel();
      };
   }, [debouncedPrefixSearch]);

   const acceptSuggestion = useCallback(() => {
      if (!suggestion) return;
      const nextSlash = suggestion.indexOf("/");
      const accepted =
         nextSlash >= 0 ? suggestion.substring(0, nextSlash + 1) : suggestion;
      const next = searchText + accepted;
      setSearchText(next);
      debouncedPrefixSearch(next);
   }, [suggestion, searchText, debouncedPrefixSearch]);

   const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchText(e.target.value);
      debouncedPrefixSearch(e.target.value);
   };

   return (
      <div className={cn("relative flex-initial items-center flex", className)}>
         <SearchIcon className="absolute left-3 text-viewertext size-4 z-10" />
         <input
            disabled={!gridReady}
            placeholder="Search..."
            className="border-input relative z-0 flex h-9 w-full min-w-0 rounded-lg border bg-transparent px-3 py-1 pl-10 text-base transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
            value={searchText}
            onChange={handleInputChange}
            onKeyDown={(e) => {
               if (e.key === "Tab" && suggestion) {
                  e.preventDefault();
                  acceptSuggestion();
               }
            }}
            autoComplete="off"
            spellCheck={false}
         />
         {suggestion && (
            <div
               aria-hidden
               className="pointer-events-none absolute inset-0 z-10 flex items-center pl-10 pr-3 text-base md:text-sm overflow-hidden whitespace-pre"
            >
               <span className="invisible">{searchText}</span>
               <span className="text-gray-400">{suggestion}</span>
            </div>
         )}
      </div>
   );
};

export default PrefixSearch;
