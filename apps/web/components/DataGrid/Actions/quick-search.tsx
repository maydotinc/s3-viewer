import { Input } from "@s3-viewer/ui/components/input";
import { Search as SearchIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { useGridContext } from "../context";

const QuickSearch = () => {
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
      <div className="relative flex-initial md:min-w-1/2 items-center flex">
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
