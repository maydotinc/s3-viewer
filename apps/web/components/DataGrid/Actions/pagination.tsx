import { authClient } from "@s3-viewer/auth/client";
import { Button } from "@s3-viewer/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuCheckboxItem,
   DropdownMenuContent,
   DropdownMenuLabel,
   DropdownMenuTrigger,
} from "@s3-viewer/ui/components/dropdown-menu";
import { cn } from "@s3-viewer/ui/lib/utils";
import { ChevronDown, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useGridContext } from "../context";

const sizes = [25, 50, 100];

type PaginationProps = {
   className?: string;
};

const Pagination = ({ className }: PaginationProps) => {
   const { data: session, isPending } = authClient.useSession();
   const { gridRef, gridReady, setPageSize } = useGridContext();
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
            <Button
               className={cn(
                  "flex-initial focus:outline-none focus:ring-0 focus-visible:ring-0",
                  className
               )}
               disabled={!session && !isPending}
            >
               {`Rows (${currentPageSize ?? 100})`}
               <ChevronDown
                  className={cn(
                     "size-4 text-gray-600 transition-transform duration-200",
                     { "rotate-180": isOpen }
                  )}
               />
            </Button>
         </DropdownMenuTrigger>
         <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]">
            {currentPageSize ? (
               sizes.map((size) => (
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
               ))
            ) : (
               <DropdownMenuLabel>
                  <Loader2 className="w-4 h-4 animate-spin" />
               </DropdownMenuLabel>
            )}
         </DropdownMenuContent>
      </DropdownMenu>
   );
};

export default Pagination;
