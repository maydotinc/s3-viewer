import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import dynamic from "next/dynamic";
import type BaseGrid from "./grid";

/** Skeleton rows match the 44px row height of the real table (DESIGN.md §3). */
const GridSkeleton = () => (
   <div className="flex w-full flex-1 flex-col gap-2 p-4" aria-busy="true">
      {Array.from({ length: 8 }, (_, index) => (
         <Skeleton key={index} className="h-11 w-full shrink-0 rounded-lg" />
      ))}
   </div>
);

const LazyGrid = dynamic(() => import("./grid"), {
   ssr: false,
   loading: GridSkeleton,
}) as typeof BaseGrid;

export { GridSkeleton, LazyGrid };
