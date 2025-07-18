import useBuckets from "@/lib/hooks/queries/s3/useBuckets";
import { S3Bucket } from "@s3-viewer/types";
import { ColDef } from "ag-grid-community";
import { CustomCellRendererProps } from "ag-grid-react";
import Link from "next/link";
import { useEffect } from "react";
import Filter from "../DataGrid/Actions/filter";
import PaginationControls from "../DataGrid/Actions/page-controls";
import Pagination from "../DataGrid/Actions/pagination";
import QuickSearch from "../DataGrid/Actions/quick-search";
import { GridProvider, useGridContext } from "../DataGrid/context";
import BaseGrid from "../DataGrid/grid";
import BucketActions from "./actions";

const columns: ColDef<S3Bucket>[] = [
   {
      field: "Name",
      headerName: "Bucket Name",
      flex: 2,
      cellRenderer: (props: CustomCellRendererProps) => (
         <Link
            href={`/buckets/${props.data.Name}`}
            className="hover:underline hover:text-viewerblue"
         >
            {props.value}
         </Link>
      ),
   },
   {
      field: "CreationDate",
      headerName: "Creation Date",
      flex: 1,
      valueFormatter: (params) => {
         return new Date(params.value).toLocaleDateString();
      },
   },
];

const BucketsGrid = () => {
   const { buckets, isBucketsLoading } = useBuckets();
   const { gridRef, gridReady } = useGridContext();

   useEffect(() => {
      if (!gridReady || !gridRef.current?.api || isBucketsLoading) return;
      const api = gridRef.current.api;
      api.setGridOption("rowData", buckets ?? []);
   }, [buckets, gridReady, isBucketsLoading, gridRef.current?.api]);

   const noRowsOverlayComponent = () => {
      return (
         <div className="flex flex-col items-center justify-center h-full">
            <h1 className="text-2xl font-bold text-viewerblack">
               You have no buckets
            </h1>
            <p className="text-sm text-viewertext">
               Please create a bucket to get started.
            </p>
         </div>
      );
   };

   return (
      <BaseGrid
         colDefs={columns}
         className="flex-1"
         rowModel={{
            type: "clientSide",
         }}
         noRowsOverlayComponent={noRowsOverlayComponent}
      />
   );
};

const Buckets = () => {
   return (
      <GridProvider>
         <section className="flex flex-col p-8 w-full h-full">
            <div className="flex flex-wrap pb-6 justify-between gap-2">
               <div className="flex gap-2 flex-1">
                  <QuickSearch />
                  <Filter />
                  <Pagination />
               </div>
               <BucketActions />
            </div>
            <div className="flex flex-col flex-1 gap-2">
               <BucketsGrid />
               <PaginationControls />
            </div>
         </section>
      </GridProvider>
   );
};

export default Buckets;
