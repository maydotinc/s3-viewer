import { authClient } from "@s3-viewer/auth/client";
import { Button } from "@s3-viewer/ui/components/button";
import {
   DropdownMenu,
   DropdownMenuCheckboxItem,
   DropdownMenuContent,
   DropdownMenuTrigger,
} from "@s3-viewer/ui/components/dropdown-menu";
import { cn } from "@s3-viewer/ui/lib/utils";
import { Column } from "ag-grid-community";
import { ListFilter } from "lucide-react";
import { useEffect, useState } from "react";
import { useGridContext } from "../context";

type FilterProps = {
   className?: string;
};

const Filter = ({ className }: FilterProps) => {
   const { data: session, isPending } = authClient.useSession();
   const { gridRef, gridReady } = useGridContext();
   const [allColumns, setAllColumns] = useState<Column[] | null>(null);
   const [filteredColumns, setFilteredColumns] = useState<Column[] | null>(
      null
   );

   useEffect(() => {
      if (gridReady) {
         const rawColumns = gridRef.current?.api?.getColumns() ?? [];
         const columns = rawColumns.filter(
            (col) =>
               col.getColId() !== "actions" && col.getColId() !== "selector"
         );
         setAllColumns(columns);
         setFilteredColumns(columns);
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
            <Button
               className={cn("flex-initial", className)}
               disabled={!session && !isPending}
            >
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
                        setFilteredColumns([
                           ...(filteredColumns ?? []),
                           column,
                        ]);
                     } else {
                        setFilteredColumns(
                           filteredColumns?.filter((c) => c !== column) ?? []
                        );
                     }
                  }}
               >
                  {column.getColDef().headerName ?? column.getColId()}
               </DropdownMenuCheckboxItem>
            ))}
         </DropdownMenuContent>
      </DropdownMenu>
   );
};

export default Filter;
