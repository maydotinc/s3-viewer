import { Button } from "@s3-viewer/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuRadioGroup,
   DropdownMenuRadioItem,
   DropdownMenuTrigger,
} from "@s3-viewer/ui/components/dropdown-menu";
import { cn } from "@s3-viewer/ui/lib/utils";
import {
   ChevronDown,
   ChevronFirst,
   ChevronLast,
   ChevronLeft,
   ChevronRight,
} from "lucide-react";
import { PAGE_SIZES, useGridContext } from "./context";

const NAV_BUTTON = "size-8";

/**
 * Full-width pagination bar that sits under the grid, inside the same bordered
 * card. Its height never changes, so nothing shifts while a page loads.
 */
const GridPagination = ({ className }: { className?: string }) => {
   const {
      gridReady,
      page,
      pageSize,
      setPageSize,
      totalPages,
      rowCount,
      goToPage,
   } = useGridContext();

   const lastKnown = totalPages !== null;
   const atFirst = page <= 0;
   const atLast = lastKnown && page >= totalPages - 1;
   const disabled = !gridReady;

   const from = rowCount === 0 ? 0 : page * pageSize + 1;
   // The infinite model grows rowCount a block at a time, so it can briefly sit
   // below the current page's first row — clamp rather than print "101–100".
   const to = Math.max(from, Math.min((page + 1) * pageSize, rowCount));
   const summary =
      rowCount === 0
         ? "0 items"
         : lastKnown
           ? `Showing ${from}–${to} of ${rowCount}`
           : `Showing ${from}–${to}`;

   return (
      <nav
         aria-label="Pagination"
         className={cn(
            "flex h-12 w-full shrink-0 items-center justify-between gap-4 border-t border-viewerborder px-3",
            className
         )}
      >
         <span className="min-w-0 truncate text-sm text-viewertext tabular-nums">
            {gridReady ? summary : ""}
         </span>
         <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-sm text-viewertext md:inline">
               Rows per page
            </span>
            <DropdownMenu>
               <DropdownMenuTrigger asChild>
                  <Button
                     variant="outline"
                     size="sm"
                     aria-label={`${pageSize} rows per page`}
                     disabled={disabled}
                     className="tabular-nums"
                  >
                     {pageSize}
                     <ChevronDown aria-hidden="true" />
                  </Button>
               </DropdownMenuTrigger>
               <DropdownMenuContent align="end" className="min-w-24">
                  <DropdownMenuRadioGroup
                     value={String(pageSize)}
                     onValueChange={(value) => setPageSize(Number(value))}
                  >
                     {PAGE_SIZES.map((size) => (
                        <DropdownMenuRadioItem
                           key={size}
                           value={String(size)}
                           className="tabular-nums"
                        >
                           {size}
                        </DropdownMenuRadioItem>
                     ))}
                  </DropdownMenuRadioGroup>
               </DropdownMenuContent>
            </DropdownMenu>
            <div className="flex items-center gap-1">
               <Button
                  variant="ghost"
                  size="icon"
                  className={NAV_BUTTON}
                  aria-label="First page"
                  disabled={disabled || atFirst}
                  onClick={() => goToPage(0)}
               >
                  <ChevronFirst aria-hidden="true" />
               </Button>
               <Button
                  variant="ghost"
                  size="icon"
                  className={NAV_BUTTON}
                  aria-label="Previous page"
                  disabled={disabled || atFirst}
                  onClick={() => goToPage(page - 1)}
               >
                  <ChevronLeft aria-hidden="true" />
               </Button>
               {lastKnown && (
                  <span className="px-1 text-sm text-viewertext tabular-nums">
                     Page {page + 1} of {totalPages}
                  </span>
               )}
               <Button
                  variant="ghost"
                  size="icon"
                  className={NAV_BUTTON}
                  aria-label="Next page"
                  disabled={disabled || atLast}
                  onClick={() => goToPage(page + 1)}
               >
                  <ChevronRight aria-hidden="true" />
               </Button>
               <Button
                  variant="ghost"
                  size="icon"
                  className={NAV_BUTTON}
                  aria-label="Last page"
                  disabled={disabled || !lastKnown || atLast}
                  onClick={() => goToPage(totalPages ? totalPages - 1 : 0)}
               >
                  <ChevronLast aria-hidden="true" />
               </Button>
            </div>
         </div>
      </nav>
   );
};

export default GridPagination;
export { GridPagination };
