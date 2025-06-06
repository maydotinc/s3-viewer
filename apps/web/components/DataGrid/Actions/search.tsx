import { Input } from "@s3-viewer/ui/components/input";
import { AgGridReact } from "ag-grid-react";
import { useCallback, useState } from "react";

type SearchProps = {
    gridRef: React.RefObject<AgGridReact | null>;
    gridReady: boolean;
}

const Search = ({ gridRef, gridReady }: SearchProps) => {
    const [searchText, setSearchText] = useState("");

    const handleQuickFilter = useCallback((value: string) => {
        setSearchText(value);
        gridRef.current?.api.setGridOption('quickFilterText', value);
    }, [setSearchText]);

    return (
        <Input 
            disabled={!gridReady}
            placeholder="Search..." 
            className="flex-1 md:min-w-1/2" 
            value={searchText}
            onChange={(e) => handleQuickFilter(e.target.value)}
        />
    )
}

export default Search;