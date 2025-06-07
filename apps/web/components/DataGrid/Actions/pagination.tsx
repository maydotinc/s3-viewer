import { Button } from "@s3-viewer/ui/components/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger } from "@s3-viewer/ui/components/dropdown-menu";
import { cn } from "@s3-viewer/ui/lib/utils";
import { AgGridReact } from "ag-grid-react";
import { ChevronDown, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

type PaginationProps = {
    gridRef: React.RefObject<AgGridReact | null>;
    gridReady: boolean;
    setPageSize: (pageSize: number) => void;
}

const Pagination = ({ gridRef, gridReady, setPageSize }: PaginationProps) => {
    const [sizes, setSizes] = useState<number[]>([25, 50, 100]);
    const [currentPageSize, setCurrentPageSize] = useState<number | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (gridReady && gridRef.current?.api) {
            const pageSize = gridRef.current.api.paginationGetPageSize();
            setCurrentPageSize(pageSize);
        }
    }, [gridReady]);

    useEffect(() => {
        if (currentPageSize !== null) {
            console.log('Page size updated:', currentPageSize);
        }
    }, [currentPageSize]);
    
    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <Button>
                    {`Rows per page (${currentPageSize})`}
                    <ChevronDown className={cn("size-4 text-gray-600 transition-transform duration-200", { "rotate-180": isOpen })} />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-fit">
                {currentPageSize ? sizes.map((size) => (
                    <DropdownMenuCheckboxItem 
                        key={size}
                        checked={size === currentPageSize}
                        onCheckedChange={(checked) => {
                            if (checked) {
                                setPageSize(size);
                                setCurrentPageSize(size);
                            }
                        }}
                    >
                        {size}
                    </DropdownMenuCheckboxItem>
                )) : <DropdownMenuLabel>
                    <Loader2 className="w-4 h-4 animate-spin" />
                </DropdownMenuLabel>}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

export default Pagination;