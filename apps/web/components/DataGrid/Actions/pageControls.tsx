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
import { useGridContext } from "../Contexts/grid-context";

type PaginationControlsProps = {
   className?: string;
};

const PaginationControls = ({ className }: PaginationControlsProps) => {
   const { gridRef, gridReady, pageSize } = useGridContext();
   const [currentPage, setCurrentPage] = useState(0);
   const [totalPages, setTotalPages] = useState(0);
   const [isOpen, setIsOpen] = useState(false);
   const [pageInput, setPageInput] = useState<number | string>(1);

   useEffect(() => {
      if (gridReady && gridRef.current?.api) {
         setCurrentPage(gridRef.current.api.paginationGetCurrentPage());
         setTotalPages(gridRef.current.api.paginationGetTotalPages());
      }
   }, [gridReady, pageSize]);

   const handlePageChange = () => {
      if (pageInput === "" || isNaN(parseInt(pageInput.toString())))
         setPageInput(1);
      else if (parseInt(pageInput.toString()) > totalPages)
         setPageInput(totalPages.toString());
      else if (parseInt(pageInput.toString()) < 1) setPageInput(1);
      else {
         gridRef.current?.api.paginationGoToPage(
            parseInt(pageInput.toString()) - 1
         );
         setCurrentPage(parseInt(pageInput.toString()) - 1);
         setIsOpen(false);
      }
   };

   return (
      <div className="flex gap-2 mx-auto" hidden={totalPages === 0}>
         <Button
            onClick={() => {
               gridRef.current?.api.paginationGoToFirstPage();
               setCurrentPage(0);
            }}
            disabled={currentPage === 0}
         >
            <ChevronFirst className="size-4" />
         </Button>
         <Button
            onClick={() => {
               gridRef.current?.api.paginationGoToPreviousPage();
               setCurrentPage((prev) => prev - 1);
            }}
            disabled={currentPage === 0}
         >
            <ChevronLeft className="size-4" />
         </Button>
         <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
               <Button>
                  {`Page ${currentPage + 1} of ${totalPages}`}
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
               setCurrentPage((prev) => prev + 1);
            }}
            disabled={currentPage === totalPages - 1}
         >
            <ChevronRight className="size-4" />
         </Button>
         <Button
            onClick={() => {
               gridRef.current?.api.paginationGoToLastPage();
               setCurrentPage(totalPages - 1);
            }}
            disabled={currentPage === totalPages - 1}
         >
            <ChevronLast className="size-4" />
         </Button>
      </div>
   );
};

export default PaginationControls;
