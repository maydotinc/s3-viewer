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
   type LucideIcon,
} from "lucide-react";
import { SimpleTooltip } from "@s3-viewer/ui/components/tooltip";
import { PAGE_SIZES, useGridPaginationContext } from "./context";

const NAV_BUTTON = "size-8";

const NavButton = ({
   label,
   icon: Icon,
   disabled,
   onClick,
}: {
   label: string;
   icon: LucideIcon;
   disabled: boolean;
   onClick: () => void;
}) => (
   <SimpleTooltip label={label}>
      <Button
         variant="ghost"
         size="icon"
         className={NAV_BUTTON}
         aria-label={label}
         disabled={disabled}
         onClick={onClick}
      >
         <Icon aria-hidden="true" />
      </Button>
   </SimpleTooltip>
);

const GridPagination = ({ className }: { className?: string }) => {
   const {
      gridReady,
      page,
      pageSize,
      setPageSize,
      totalPages,
      rowCount,
      goToPage,
   } = useGridPaginationContext();

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
            "flex h-12 w-full shrink-0 items-center justify-between gap-4 border-t border-viewerborder px-4",
            className
         )}
      >
         {/* The controls always win the row: the summary disappears rather
             than truncating to a fragment like "S…". */}
         <span className="hidden min-w-0 truncate text-sm text-viewertext tabular-nums md:block">
            {gridReady ? summary : ""}
         </span>
         <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-sm text-viewertext lg:inline">
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
               <NavButton
                  label="First page"
                  icon={ChevronFirst}
                  disabled={disabled || atFirst}
                  onClick={() => goToPage(0)}
               />
               <NavButton
                  label="Previous page"
                  icon={ChevronLeft}
                  disabled={disabled || atFirst}
                  onClick={() => goToPage(page - 1)}
               />
               {lastKnown && (
                  <span className="hidden px-1 text-sm text-viewertext tabular-nums lg:inline">
                     Page {page + 1} of {totalPages}
                  </span>
               )}
               <NavButton
                  label="Next page"
                  icon={ChevronRight}
                  disabled={disabled || atLast}
                  onClick={() => goToPage(page + 1)}
               />
               <NavButton
                  label="Last page"
                  icon={ChevronLast}
                  disabled={disabled || !lastKnown || atLast}
                  onClick={() => goToPage(totalPages ? totalPages - 1 : 0)}
               />
            </div>
         </div>
      </nav>
   );
};

export default GridPagination;
