import useBuckets from "@/lib/hooks/queries/s3/useBuckets";
import { testBuckets } from "@/lib/utils/test-data";
import { S3Bucket } from "@s3-viewer/types";
import { ColDef } from "ag-grid-community";
import { CustomCellRendererProps } from "ag-grid-react";
import Link from "next/link";
import Filter from "../DataGrid/Actions/filter";
import PaginationControls from "../DataGrid/Actions/page-controls";
import Pagination from "../DataGrid/Actions/pagination";
import QuickSearch from "../DataGrid/Actions/quick-search";
import { GridProvider } from "../DataGrid/context";
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
   {
      field: "Files",
      headerName: "Files",
      flex: 1,
   },
   {
      field: "Folders",
      headerName: "Folders",
      flex: 1,
   },
   {
      field: "TotalSize",
      headerName: "Total Size",
      flex: 1,
   },
];

const Buckets = () => {
   const { buckets } = useBuckets();

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
      <GridProvider>
         <section className="flex flex-col p-8 w-full h-full">
            <div className="flex lg:flex-row flex-col pb-6 justify-between gap-2">
               <div className="flex gap-2">
                  <QuickSearch className="flex-2/3" />
                  <Filter className="flex-1/3" />
                  <Pagination className="flex-1/3" />
               </div>
               <BucketActions />
            </div>
            <div className="flex flex-col flex-1 gap-2">
               <BaseGrid
                  rowData={buckets ?? testBuckets}
                  colDefs={columns}
                  className="flex-1"
                  rowModel={{
                     type: "clientSide",
                  }}
                  noRowsOverlayComponent={noRowsOverlayComponent}
               />
               <PaginationControls />
            </div>
         </section>
      </GridProvider>
   );
};

export default Buckets;
