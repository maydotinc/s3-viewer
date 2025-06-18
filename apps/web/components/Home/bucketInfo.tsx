import { fetchFolders } from "@/lib/utils/fetching";
import testData from "@/lib/utils/test";
import { BucketFolder } from "@/lib/utils/types";
import { useQuery } from "@tanstack/react-query";
import { ColDef, GridReadyEvent } from "ag-grid-community";
import { AgGridReact, CustomCellRendererProps } from "ag-grid-react";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { createContext, useCallback, useRef, useState } from "react";
import PaginationControls from "../DataGrid/Actions/pageControls";
import BaseGrid from "../DataGrid/baseGrid";
import GridActions from "../DataGrid/gridActions";
import BucketActions from "./bucketActions";

const BucketFormatter = (props: CustomCellRendererProps) => {
   return (
      <Link href={`/buckets/${props.value}`} className="hover:underline hover:text-viewerblue">
         {props.value}
      </Link>
   );
};

const columns: ColDef<BucketFolder>[] = [
   {
      field: "Name",
      headerName: "Bucket Name",
      flex: 2,
      cellRenderer: BucketFormatter,
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

type GridContextType = {
   gridRef: React.RefObject<AgGridReact | null>;
   gridReady: boolean;
   pageSize: number;
   setPageSize: (size: number) => void;
   onGridReady: (params: GridReadyEvent) => void;
};

export const GridContext = createContext<GridContextType | null>(null);

const BucketInfo = () => {
   const gridRef = useRef<AgGridReact>(null);
   const [gridReady, setGridReady] = useState(false);
   const [pageSize, setPageSize] = useState(25);

   const onGridReady = useCallback((params: GridReadyEvent) => {
      setGridReady(true);
   }, []);

   const { data: folders, isLoading } = useQuery({
      queryKey: ["folders"],
      queryFn: fetchFolders,
      refetchOnMount: true,
   });

   return (
      <GridContext.Provider value={{ gridRef, gridReady, pageSize, setPageSize, onGridReady }}>
         <section className="flex flex-col px-8 py-8 w-full h-full">
            <div className="flex lg:flex-row flex-col pb-6 justify-between gap-2">
               <GridActions />
               <BucketActions />
            </div>
            {isLoading ? (
               <div className="flex justify-center items-center h-full">
                  <Loader2 className="w-10 h-10 animate-spin" />
               </div>
            ) : (
               <div className="flex flex-col flex-1 gap-2">
                  <BaseGrid rowData={testData ?? []} colDefs={columns} className="flex-1" />
                  <PaginationControls />
               </div>
            )}
         </section>
      </GridContext.Provider>
   );
};

export default BucketInfo;
