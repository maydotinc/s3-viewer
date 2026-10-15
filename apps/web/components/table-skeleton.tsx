import { CellBar, nameBarWidth } from "@/components/DataGrid/skeleton";
import { TableCell, TableRow } from "@s3-viewer/ui/components/table";
import { cn } from "@s3-viewer/ui/lib/utils";

type SkeletonColumn = { align?: "left" | "right" };

type TableSkeletonRowsProps = {
   columns: readonly SkeletonColumn[];
   rowClassName?: string;
};

const TableSkeletonRows = ({
   columns,
   rowClassName,
}: TableSkeletonRowsProps) => (
   <>
      {Array.from({ length: 3 }, (_, row) => (
         <TableRow
            key={row}
            aria-hidden="true"
            className={cn("hover:bg-transparent", rowClassName)}
         >
            {columns.map((column, index) => (
               <TableCell key={index}>
                  <CellBar
                     className={cn(
                        index === 0
                           ? nameBarWidth(row)
                           : index === columns.length - 1
                             ? "ml-auto w-8"
                             : "w-16",
                        column.align === "right" && "ml-auto"
                     )}
                  />
               </TableCell>
            ))}
         </TableRow>
      ))}
   </>
);

export default TableSkeletonRows;
