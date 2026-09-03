import dynamic from "next/dynamic";
import type BaseGrid from "./grid";
import { GridSkeleton } from "./skeleton";

const LazyGrid = dynamic(() => import("./grid"), {
   ssr: false,
   loading: () => <GridSkeleton />,
}) as typeof BaseGrid;

export { GridSkeleton, LazyGrid };
