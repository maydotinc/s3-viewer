import { GridContext } from "@/components/Home/bucketInfo";
import { Input } from "@s3-viewer/ui/components/input";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { cn } from "@s3-viewer/ui/lib/utils";
import { Search as SearchIcon } from "lucide-react";
import { useCallback, useContext, useState } from "react";

type SearchProps = {
    className?: string;
}

const Search = ({ className }: SearchProps) => {
    const context = useContext(GridContext);
    if (!context) {
        return (
            <div className={cn("relative flex-1 md:min-w-1/2 items-center flex", className)}>
                <Skeleton className="size-full" />
            </div>
        );
    }

    const { gridRef, gridReady } = context;
    const [searchText, setSearchText] = useState("");

    const handleQuickFilter = useCallback((value: string) => {
        setSearchText(value);
        gridRef.current?.api.setGridOption('quickFilterText', value);
    }, [setSearchText]);

    return (
        <div className={cn("relative flex-1 md:min-w-1/2 items-center flex", className)}>
            <SearchIcon className="absolute left-3 text-viewertext size-4" />
            <Input 
                disabled={!gridReady}
                placeholder="Search..." 
                className="pl-10" 
                value={searchText}
                onChange={(e) => handleQuickFilter(e.target.value)}
            />
        </div>
    )
}

export default Search;