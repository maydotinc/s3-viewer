import { GridContext } from "@/components/Home/bucketInfo";
import { Button } from "@s3-viewer/ui/components/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger } from "@s3-viewer/ui/components/dropdown-menu";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { cn } from "@s3-viewer/ui/lib/utils";
import { ChevronDown, Loader2 } from "lucide-react";
import { useContext, useEffect, useState } from "react";

type PaginationProps = {
    className?: string;
}

const sizes = [25, 50, 100];

const Pagination = ({ className }: PaginationProps) => {
    const context = useContext(GridContext);
    if (!context) {
        return (
            <div className={cn("relative flex-1 md:min-w-1/2 items-center flex", className)}>
                <Skeleton className="size-full" />
            </div>
        );
    }

    const { gridRef, gridReady, setPageSize } = context;
    const [currentPageSize, setCurrentPageSize] = useState<number | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (gridReady && gridRef.current?.api) {
            const pageSize = gridRef.current.api.paginationGetPageSize();
            setCurrentPageSize(pageSize);
        }
    }, [gridReady]);

    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <Button>
                    {`Rows per page (${currentPageSize ?? 25})`}
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