import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { cn } from "@s3-viewer/ui/lib/utils";
import type { ColDef } from "ag-grid-community";
import { useLayoutEffect, useMemo, useRef, useState, type Ref } from "react";
import { hiddenColumnIds, withHiddenColumns } from "./fit-columns";

type SkeletonSource = {
   flex?: number | null;
   width?: number | null;
   minWidth?: number | null;
   hide?: boolean | null;
   cellClass?: unknown;
};

type SkeletonColumn = {
   flex: boolean;
   width: number;
   minWidth?: number;
   weight?: number;
   align: "left" | "right";
   control: boolean;
};

const CONTROL_MAX_WIDTH = 64;

const RIGHT_ALIGNED_CLASS = "ag-right-aligned-cell";

const hasClass = (value: unknown, name: string): boolean =>
   typeof value === "string"
      ? value.split(" ").includes(name)
      : Array.isArray(value) && value.includes(name);

const toSkeletonColumns = (
   columns: readonly SkeletonSource[]
): SkeletonColumn[] =>
   columns
      .filter((column) => !column.hide)
      .map((column) => {
         const width = column.width ?? 0;
         const flex = Boolean(column.flex) || width === 0;
         return {
            flex,
            width,
            minWidth: column.minWidth ?? 0,
            weight: column.flex ?? 1,
            align: hasClass(column.cellClass, RIGHT_ALIGNED_CLASS)
               ? "right"
               : "left",
            control: !flex && width <= CONTROL_MAX_WIDTH,
         };
      });

const DEFAULT_COLUMNS: SkeletonColumn[] = [
   { flex: true, width: 0, align: "left", control: false },
   { flex: false, width: 200, align: "right", control: false },
   { flex: false, width: 120, align: "left", control: false },
   { flex: false, width: 64, align: "left", control: true },
];

const NAME_WIDTHS = [
   "w-40",
   "w-56",
   "w-32",
   "w-48",
   "w-36",
   "w-52",
   "w-44",
   "w-40",
];

const SKELETON_ROWS = 12;

const BAR = "h-3.5 rounded";

const CellBar = ({ className }: { className?: string }) => (
   <Skeleton className={cn(BAR, className)} />
);

const nameBarWidth = (rowIndex: number): string =>
   NAME_WIDTHS[Math.abs(rowIndex) % NAME_WIDTHS.length] ?? "w-40";

const Line = ({
   columns,
   header = false,
   name,
}: {
   columns: readonly SkeletonColumn[];
   header?: boolean;
   name: string;
}) => {
   const bar = cn(BAR, header && "bg-viewerborder");
   return (
      <div
         className={cn(
            "flex h-11 shrink-0 items-center border-b border-viewerborder",
            header && "bg-viewergray/60"
         )}
      >
         {columns.map((column, index) => (
            <div
               key={index}
               className={cn(
                  "flex items-center",
                  column.flex ? "gap-2.5" : "shrink-0",
                  !column.control && "px-4",
                  column.align === "right" && "justify-end"
               )}
               style={
                  column.flex
                     ? {
                          flex: `${column.weight ?? 1} 1 0%`,
                          minWidth: column.minWidth ?? 0,
                       }
                     : { width: column.width }
               }
            >
               {column.control ? null : column.flex ? (
                  <>
                     {!header && (
                        <Skeleton className="size-4 shrink-0 rounded" />
                     )}
                     <Skeleton className={cn(bar, header ? "w-14" : name)} />
                  </>
               ) : (
                  <Skeleton className={cn(bar, "w-14")} />
               )}
            </div>
         ))}
      </div>
   );
};

type SkeletonProps = {
   columns?: readonly SkeletonSource[];
   className?: string;
};

const SkeletonRows = ({ columns, className }: SkeletonProps) => {
   const layout = columns ? toSkeletonColumns(columns) : DEFAULT_COLUMNS;
   return (
      <div
         className={cn("flex size-full flex-col overflow-hidden", className)}
         aria-busy="true"
         aria-label="Loading rows"
      >
         {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <Line key={index} columns={layout} name={nameBarWidth(index)} />
         ))}
      </div>
   );
};

const GridSkeleton = ({
   columns,
   className,
   ref,
}: SkeletonProps & { ref?: Ref<HTMLDivElement> }) => {
   const layout = columns ? toSkeletonColumns(columns) : DEFAULT_COLUMNS;
   return (
      <div
         ref={ref}
         className={cn(
            "flex min-h-0 w-full flex-1 flex-col overflow-hidden",
            className
         )}
         aria-busy="true"
      >
         <Line columns={layout} header name="w-14" />
         <SkeletonRows columns={columns} className="min-h-0 flex-1" />
      </div>
   );
};

const FittedGridSkeleton = ({
   columns,
   className,
}: {
   columns?: readonly ColDef[];
   className?: string;
}) => {
   const ref = useRef<HTMLDivElement>(null);
   const [width, setWidth] = useState(0);
   useLayoutEffect(() => {
      setWidth(ref.current?.clientWidth ?? 0);
   }, []);
   const fitted = useMemo(
      () =>
         columns && width > 0
            ? withHiddenColumns([...columns], hiddenColumnIds(columns, width))
            : columns,
      [columns, width]
   );
   return <GridSkeleton ref={ref} columns={fitted} className={className} />;
};

export {
   CellBar,
   FittedGridSkeleton,
   nameBarWidth,
   SKELETON_ROWS,
   SkeletonRows,
};
