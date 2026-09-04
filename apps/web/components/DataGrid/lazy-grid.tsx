import type { ColDef } from "ag-grid-community";
import dynamic from "next/dynamic";
import { createContext, useContext } from "react";
import type BaseGrid from "./grid";
import type { BaseGridProps } from "./grid";
import { GridSkeleton } from "./skeleton";

// next/dynamic renders its `loading` component with no props, so the columns
// reach the skeleton through context instead.
const SkeletonColumns = createContext<readonly ColDef[] | undefined>(undefined);

const ChunkSkeleton = () => (
   <GridSkeleton columns={useContext(SkeletonColumns)} />
);

const GridChunk = dynamic(() => import("./grid"), {
   ssr: false,
   loading: ChunkSkeleton,
}) as typeof BaseGrid;

const LazyGrid = <TData,>(props: BaseGridProps<TData>) => (
   <SkeletonColumns.Provider value={props.columnDefs as readonly ColDef[]}>
      <GridChunk {...props} />
   </SkeletonColumns.Provider>
);

export { GridSkeleton, LazyGrid };
