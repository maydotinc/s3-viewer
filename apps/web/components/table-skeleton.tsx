import { CellBar, nameBarWidth } from "@/components/DataGrid/skeleton";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { TableCell, TableRow } from "@s3-viewer/ui/components/table";
import { cn } from "@s3-viewer/ui/lib/utils";

// avatar: a person cell (avatar, name and email) like the members list
type SkeletonColumn = {
   align?: "left" | "right";
   avatar?: boolean;
   checkbox?: boolean;
   className?: string;
};

type TableSkeletonRowsProps = {
   columns: readonly SkeletonColumn[];
   rows?: number;
   rowClassName?: string;
};

// bars sit in text-sm line boxes so rows stacked into cards on narrow panels keep the height of real text
const Line = ({ className }: { className: string }) => (
   <div className="flex h-5 items-center">
      <CellBar className={className} />
   </div>
);

const TableSkeletonRows = ({
   columns,
   rows = 3,
   rowClassName,
}: TableSkeletonRowsProps) => {
   const nameColumn = columns.findIndex((column) => !column.checkbox);
   return (
      <>
         {Array.from({ length: rows }, (_, row) => (
            <TableRow
               key={row}
               aria-hidden="true"
               className={cn("hover:bg-transparent", rowClassName)}
            >
               {columns.map((column, index) => (
                  <TableCell key={index} className={column.className}>
                     {column.checkbox ? (
                        <Skeleton className="size-4 rounded-[4px]" />
                     ) : column.avatar ? (
                        <div className="flex min-w-0 items-center gap-3">
                           <Skeleton className="size-8 shrink-0 rounded-full" />
                           <div className="flex min-w-0 flex-col">
                              <Line className={nameBarWidth(row)} />
                              <div className="flex h-4 items-center">
                                 <CellBar className="h-3 w-44 max-w-full" />
                              </div>
                           </div>
                        </div>
                     ) : (
                        <Line
                           className={cn(
                              index === nameColumn
                                 ? nameBarWidth(row)
                                 : index === columns.length - 1 &&
                                     column.align !== "left"
                                   ? "ml-auto w-8"
                                   : "w-16",
                              column.align === "right" && "ml-auto"
                           )}
                        />
                     )}
                  </TableCell>
               ))}
            </TableRow>
         ))}
      </>
   );
};

export default TableSkeletonRows;
