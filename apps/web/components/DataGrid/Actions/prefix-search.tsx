import { Input } from "@s3-viewer/ui/components/input";
import { cn } from "@s3-viewer/ui/lib/utils";
import { debounce } from "lodash";
import { Search as SearchIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useGridContext } from "../context";

type PrefixSearchProps = {
   className?: string;
};

const PrefixSearch = ({ className }: PrefixSearchProps) => {
   const { gridRef, gridReady } = useGridContext();
   const [searchText, setSearchText] = useState("");

   const handlePrefixSearch = useCallback(
      (value: string) => {
         if (value.includes("/")) {
            value = value.split("/")[0] ?? "";
         }
         console.log("Setting filter model", value);
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

   const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchText(e.target.value);
      debouncedPrefixSearch(e.target.value);
   };

   const debouncedPrefixSearch = useMemo(
      () => debounce(handlePrefixSearch, 500),
      [handlePrefixSearch]
   );

   useEffect(() => {
      return () => {
         debouncedPrefixSearch.cancel();
      };
   }, [debouncedPrefixSearch]);

   return (
      <div
         className={cn(
            "relative flex-1 md:min-w-1/2 items-center flex",
            className
         )}
      >
         <SearchIcon className="absolute left-3 text-viewertext size-4" />
         <Input
            disabled={!gridReady}
            placeholder="Search..."
            className="pl-10"
            value={searchText}
            onChange={handleInputChange}
         />
      </div>
   );
};

export default PrefixSearch;
