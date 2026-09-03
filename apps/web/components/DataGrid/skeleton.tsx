import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { cn } from "@s3-viewer/ui/lib/utils";

/** The slice of an AG Grid `ColDef` the skeleton reads; any `ColDef<T>` fits. */
type SkeletonSource = {
   flex?: number | null;
   width?: number | null;
   cellClass?: unknown;
};

type SkeletonColumn = {
   flex: boolean;
   width: number;
   align: "left" | "right";
   /** A checkbox or row-actions column: keeps its width, shows no bar. */
   control: boolean;
};

/** Nothing narrower than this holds text (DESIGN.md §3: checkbox 40, actions 64). */
const CONTROL_MAX_WIDTH = 64;

const RIGHT_ALIGNED_CLASS = "ag-right-aligned-cell";

const hasClass = (value: unknown, name: string): boolean =>
   typeof value === "string"
      ? value.split(" ").includes(name)
      : Array.isArray(value) && value.includes(name);

const toSkeletonColumns = (
   columns: readonly SkeletonSource[]
): SkeletonColumn[] =>
   columns.map((column) => {
      const width = column.width ?? 0;
      const flex = Boolean(column.flex) || width === 0;
      return {
         flex,
         width,
         align: hasClass(column.cellClass, RIGHT_ALIGNED_CLASS)
            ? "right"
            : "left",
         control: !flex && width <= CONTROL_MAX_WIDTH,
      };
   });

/** Both tables end the same way: a name, a 200px and a 120px column, actions. */
const DEFAULT_COLUMNS: SkeletonColumn[] = [
   { flex: true, width: 0, align: "left", control: false },
   { flex: false, width: 200, align: "right", control: false },
   { flex: false, width: 120, align: "left", control: false },
   { flex: false, width: 64, align: "left", control: true },
];

// Name bars of varying length so the column reads as text, not a bar chart.
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

// Enough to fill the tallest common viewport; the container clips the rest.
const ROWS = 12;

const BAR = "h-3.5 rounded";

/**
 * One 44px line of the table. Every cell keeps the grid's own width and 16px
 * padding, so each bar lands where its text will and rows arriving replace
 * like with like.
 */
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
                  column.flex ? "min-w-0 flex-1 gap-2.5" : "shrink-0",
                  !column.control && "px-4",
                  column.align === "right" && "justify-end"
               )}
               style={column.flex ? undefined : { width: column.width }}
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
   /** The grid's column definitions; omit for the shared default layout. */
   columns?: readonly SkeletonSource[];
   className?: string;
};

/** Body rows only — what AG Grid shows under its own header while rows load. */
const SkeletonRows = ({ columns, className }: SkeletonProps) => {
   const layout = columns ? toSkeletonColumns(columns) : DEFAULT_COLUMNS;
   return (
      <div
         className={cn("flex size-full flex-col overflow-hidden", className)}
         aria-busy="true"
         aria-label="Loading rows"
      >
         {Array.from({ length: ROWS }, (_, index) => (
            <Line
               key={index}
               columns={layout}
               name={NAME_WIDTHS[index % NAME_WIDTHS.length] ?? "w-40"}
            />
         ))}
      </div>
   );
};

/**
 * The table's own anatomy while it loads (DESIGN.md §3): a header band and
 * hairline rows at the grid's 44px pitch, no spinner. Shown in place of the
 * whole grid, so it draws the header too.
 */
const GridSkeleton = ({ columns, className }: SkeletonProps) => {
   const layout = columns ? toSkeletonColumns(columns) : DEFAULT_COLUMNS;
   return (
      <div
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

export { GridSkeleton, SkeletonRows };
