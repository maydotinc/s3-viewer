import type { ColDef } from "ag-grid-community";
import dynamic from "next/dynamic";
import { createContext, useContext } from "react";
import type Grid from "./grid";
import type { GridProps } from "./grid";
import { FittedGridSkeleton } from "./skeleton";

const SkeletonColumns = createContext<readonly ColDef[] | undefined>(undefined);

const ChunkSkeleton = () => (
   <FittedGridSkeleton columns={useContext(SkeletonColumns)} />
);

const GridChunk = dynamic(() => import("./grid"), {
   ssr: false,
   loading: ChunkSkeleton,
}) as typeof Grid;

const LazyGrid = <TData,>(props: GridProps<TData>) => (
   <SkeletonColumns.Provider value={props.columnDefs as readonly ColDef[]}>
      <GridChunk {...props} />
   </SkeletonColumns.Provider>
);

export { LazyGrid };
