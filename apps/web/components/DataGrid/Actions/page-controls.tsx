import { Button } from "@s3-viewer/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuTrigger,
} from "@s3-viewer/ui/components/dropdown-menu";
import { Input } from "@s3-viewer/ui/components/input";
import { cn } from "@s3-viewer/ui/lib/utils";
import {
   ChevronFirst,
   ChevronLast,
   ChevronLeft,
   ChevronRight,
   ChevronUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useGridContext } from "../context";

type PaginationControlsProps = {
   className?: string;
};

const PaginationControls = ({ className }: PaginationControlsProps) => {
   const { gridRef, gridReady, totalPages, currentPage } = useGridContext();
   const [isOpen, setIsOpen] = useState(false);
   const [pageInput, setPageInput] = useState<number | string>(1);

   const handlePageChange = () => {
      if (!gridReady || !gridRef.current?.api) return;
      if (pageInput === "" || isNaN(parseInt(pageInput.toString()))) {
         setPageInput(1);
      }
      gridRef.current?.api.paginationGoToPage(
         parseInt(pageInput.toString()) - 1
      );
   };

   useEffect(() => {
      if (currentPage) {
         setPageInput(currentPage + 1);
      }
   }, [currentPage, gridReady]);

   if (
      !gridReady ||
      !gridRef.current?.api ||
      totalPages === null ||
      totalPages === 0 ||
      totalPages === 1
   ) {
      return null;
   }

   const forwardDisabled =
      gridRef.current?.api.paginationIsLastPageFound() &&
      gridRef.current?.api.paginationGetCurrentPage() >=
         gridRef.current?.api.paginationGetTotalPages() - 1;
   const backwardDisabled =
      gridRef.current?.api.paginationGetCurrentPage() <= 0;

   return (
      <div className={cn("flex gap-2 mx-auto", className)}>
         <Button
            onClick={() => {
               gridRef.current?.api.paginationGoToFirstPage();
            }}
            disabled={backwardDisabled}
         >
            <ChevronFirst className="size-4" />
         </Button>
         <Button
            onClick={() => {
               gridRef.current?.api.paginationGoToPreviousPage();
            }}
            disabled={backwardDisabled}
         >
            <ChevronLeft className="size-4" />
         </Button>
         <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger
               asChild
               disabled={!gridRef.current?.api.paginationIsLastPageFound()}
            >
               <Button>
                  {`Page ${currentPage ? currentPage + 1 : 1} of ${totalPages}`}
                  <ChevronUp
                     className={cn(
                        "size-4 text-gray-600 transition-transform duration-200",
                        { "rotate-180": isOpen }
                     )}
                  />
               </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-fit flex" side="top">
               <Input
                  type="text"
                  value={pageInput.toString()}
                  onChange={(e) => {
                     setPageInput(e.target.value);
                  }}
                  className="w-20"
                  placeholder="Page #"
                  onKeyDown={(e) => {
                     if (e.key === "Enter") handlePageChange();
                  }}
               />
               <Button variant="ghost" onClick={handlePageChange}>
                  Go
               </Button>
            </DropdownMenuContent>
         </DropdownMenu>
         <Button
            onClick={() => {
               gridRef.current?.api.paginationGoToNextPage();
            }}
            disabled={forwardDisabled}
         >
            <ChevronRight className="size-4" />
         </Button>
         <Button
            onClick={() => {
               gridRef.current?.api.paginationGoToLastPage();
            }}
            disabled={forwardDisabled}
         >
            <ChevronLast className="size-4" />
         </Button>
      </div>
   );
};

export default PaginationControls;
