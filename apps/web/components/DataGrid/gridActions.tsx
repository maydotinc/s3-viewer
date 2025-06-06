import { AgGridReact } from "ag-grid-react";
import Filter from "./Actions/filter";
import Pagination from "./Actions/pagination";
import Search from "./Actions/search";

type GridActionsProps = {
    gridRef: React.RefObject<AgGridReact | null>;
    gridReady: boolean;
    setPageSize: (pageSize: number) => void;
}

const GridActions = ({ gridRef, gridReady, setPageSize }: GridActionsProps) => {
    return (
        <div className="flex gap-2">
            <Search gridRef={gridRef} gridReady={gridReady} />
            <Filter gridRef={gridRef} gridReady={gridReady} />
            <Pagination gridRef={gridRef} gridReady={gridReady} setPageSize={setPageSize} />
        </div>
    )
}

export default GridActions;