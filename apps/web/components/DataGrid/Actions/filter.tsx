import { GridContext } from "@/components/Home/bucketInfo";
import { Button } from "@s3-viewer/ui/components/button";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger
} from "@s3-viewer/ui/components/dropdown-menu";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { cn } from "@s3-viewer/ui/lib/utils";
import { Column } from "ag-grid-community";
import { ListFilter } from "lucide-react";
import { useContext, useEffect, useState } from "react";

type FilterProps = {
    className?: string;
}

const Filter = ({ className }: FilterProps) => {
    const context = useContext(GridContext);
    if (!context) {
        return (
            <div className={cn("relative flex-1 md:min-w-1/2 items-center flex", className)}>
                <Skeleton className="size-full" />
            </div>
        );
    }

    const { gridRef, gridReady } = context;
    const [allColumns, setAllColumns] = useState<Column[] | null>(null);
    const [filteredColumns, setFilteredColumns] = useState<Column[] | null>(null);
    
    useEffect(() => {
        if (gridReady) {
            const cols = gridRef.current?.api?.getColumns() ?? [];
            setAllColumns(cols);
            setFilteredColumns(cols);
        }
    }, [gridReady]);

    useEffect(() => {
        if (gridReady && filteredColumns && allColumns) {
            for (const column of allColumns) {
                if (filteredColumns.includes(column)) {
                    gridRef.current?.api.setColumnsVisible([column], true);
                } else {
                    gridRef.current?.api.setColumnsVisible([column], false);
                }
            }
        }
    }, [filteredColumns]);
    
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button>
                    <ListFilter className="size-4" />
                    Filter
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-fit">
                {allColumns?.map((column) => (
                    <DropdownMenuCheckboxItem 
                        onSelect={(e) => e.preventDefault()}
                        key={column.getColId()}
                        checked={filteredColumns?.includes(column)}
                        onCheckedChange={(checked) => {
                            if (checked) {
                                setFilteredColumns([...(filteredColumns ?? []), column]);
                            } else {
                                setFilteredColumns(filteredColumns?.filter((c) => c !== column) ?? []);
                            }
                        }}
                    >
                        {column.getColDef().headerName ?? column.getColId()}
                    </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

export default Filter;