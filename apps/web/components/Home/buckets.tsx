import useBuckets from "@/lib/hooks/queries/s3/useBuckets";
import testData from "@/lib/utils/test";
import { Bucket } from "@s3-viewer/types";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { ColDef } from "ag-grid-community";
import { CustomCellRendererProps } from "ag-grid-react";
import Link from "next/link";
import GridActions from "../DataGrid/Actions";
import PaginationControls from "../DataGrid/Actions/pageControls";
import { GridProvider } from "../DataGrid/Contexts/grid-context";
import BaseGrid from "../DataGrid/grid";
import BucketActions from "./actions";

const columns: ColDef<Bucket>[] = [
   {
      field: "Name",
      headerName: "Bucket Name",
      flex: 2,
      cellRenderer: (props: CustomCellRendererProps) => (
         <Link
            href={`/buckets/${props.value}`}
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
   const { buckets, isBucketsLoading, bucketsError, refetch } = useBuckets();

   if (isBucketsLoading) {
      return (
         <section className="flex flex-col p-8 w-full h-full items-center justify-center">
            <Skeleton className="w-full h-full rounded-2xl" />
         </section>
      );
   }

   if (bucketsError) {
      return (
         <section className="flex flex-col p-8 w-full h-full items-center justify-center">
            <h1 className="text-2xl font-bold text-viewerblack">
               Please connect to a server
            </h1>
            <p className="text-sm text-viewertext">
               You are not connected to any server. Please connect to a server
               to view your buckets.
            </p>
         </section>
      );
   }

   return (
      <GridProvider>
         <section className="flex flex-col p-8 w-full h-full">
            <div className="flex lg:flex-row flex-col pb-6 justify-between gap-2">
               <GridActions />
               <BucketActions />
            </div>
            <div className="flex flex-col flex-1 gap-2">
               <BaseGrid
                  rowData={buckets ?? testData}
                  colDefs={columns}
                  className="flex-1"
               />
               <PaginationControls />
            </div>
         </section>
      </GridProvider>
   );
};

export default Buckets;
