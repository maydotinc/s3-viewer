import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import dynamic from "next/dynamic";
import type BaseGrid from "./grid";

const GridSkeleton = () => (
   <div className="flex w-full flex-1 flex-col gap-2" aria-busy="true">
      <Skeleton className="h-10 w-full rounded-lg" />
      {Array.from({ length: 8 }, (_, i) => (
         <Skeleton key={i} className="h-11 w-full rounded-lg" />
      ))}
   </div>
);

const LazyGrid = dynamic(() => import("./grid"), {
   ssr: false,
   loading: GridSkeleton,
}) as typeof BaseGrid;

export { GridSkeleton, LazyGrid };
