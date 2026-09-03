import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import dynamic from "next/dynamic";
import type BaseGrid from "./grid";

const GridSkeleton = () => (
   <div className="flex w-full flex-1 flex-col gap-2 p-2" aria-busy="true">
      {Array.from({ length: 9 }, (_, index) => (
         <Skeleton key={index} className="h-10 w-full shrink-0" />
      ))}
   </div>
);

const LazyGrid = dynamic(() => import("./grid"), {
   ssr: false,
   loading: GridSkeleton,
}) as typeof BaseGrid;

export { GridSkeleton, LazyGrid };
