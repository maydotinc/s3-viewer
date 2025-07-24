import useBuckets from "@/lib/hooks/queries/s3/useBuckets";
import { S3Bucket } from "@s3-viewer/types";
import { ColDef } from "ag-grid-community";
import { CustomCellRendererProps } from "ag-grid-react";
import Link from "next/link";
import { useEffect } from "react";
import PaginationControls from "../DataGrid/Actions/page-controls";
import { GridProvider, useGridContext } from "../DataGrid/context";
import BaseGrid from "../DataGrid/grid";
import BucketActions from "./bucket-actions";
import GridActions from "./grid-actions";

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
         <section className="flex flex-col p-8 w-full h-full @container/actions">
            <div className="@max-2xl/actions:flex-col flex flex-row pb-6 justify-between gap-2">
               <GridActions />
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
