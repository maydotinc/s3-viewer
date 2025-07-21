import { Input } from "@s3-viewer/ui/components/input";
import { cn } from "@s3-viewer/ui/lib/utils";
import { Search as SearchIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { useGridContext } from "../context";

type QuickSearchProps = {
   className?: string;
};

const QuickSearch = ({ className }: QuickSearchProps) => {
   const { gridRef, gridReady } = useGridContext();
   const [searchText, setSearchText] = useState("");

   const handleQuickFilter = useCallback(
      (value: string) => {
         setSearchText(value);
         gridRef.current?.api.setGridOption("quickFilterText", value);
      },
      [setSearchText]
   );

   return (
      <div className={cn("relative flex-initial items-center flex", className)}>
         <SearchIcon className="absolute left-3 text-viewertext size-4" />
         <Input
            disabled={!gridReady}
            placeholder="Search..."
            className="pl-10"
            value={searchText}
            onChange={(e) => handleQuickFilter(e.target.value)}
         />
      </div>
   );
};

export default QuickSearch;
