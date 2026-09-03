import { Button } from "@s3-viewer/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuRadioGroup,
   DropdownMenuRadioItem,
   DropdownMenuTrigger,
} from "@s3-viewer/ui/components/dropdown-menu";
import { cn } from "@s3-viewer/ui/lib/utils";
import { ChevronDown } from "lucide-react";
import { PAGE_SIZES, useGridContext } from "./context";

const PageSize = ({ className }: { className?: string }) => {
   const { pageSize, setPageSize, gridReady } = useGridContext();

   return (
      <DropdownMenu>
         <DropdownMenuTrigger asChild>
            <Button
               variant="outline"
               aria-label={`${pageSize} rows per page`}
               disabled={!gridReady}
               className={cn("w-28 justify-between tabular-nums", className)}
            >
               {pageSize} rows
               <ChevronDown aria-hidden="true" />
            </Button>
         </DropdownMenuTrigger>
         <DropdownMenuContent align="start" className="w-28">
            <DropdownMenuRadioGroup
               value={String(pageSize)}
               onValueChange={(value) => setPageSize(Number(value))}
            >
               {PAGE_SIZES.map((size) => (
                  <DropdownMenuRadioItem key={size} value={String(size)}>
                     {size} rows
                  </DropdownMenuRadioItem>
               ))}
            </DropdownMenuRadioGroup>
         </DropdownMenuContent>
      </DropdownMenu>
   );
};

export default PageSize;
