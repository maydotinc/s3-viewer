import useSessionStore from "@/lib/stores/sessionStore";
import { S3Object } from "@s3-viewer/types";
import { ColDef, ICellRendererParams } from "ag-grid-community";
import { Loader2 } from "lucide-react";
import { GridProvider } from "../DataGrid/context";
import BaseGrid from "../DataGrid/grid";
import MakeObjectSource from "./object-source";

const columns: ColDef<S3Object>[] = [
   {
      field: "Key",
      headerName: "Name",
      flex: 2,
      cellRenderer: (params: ICellRendererParams) => {
         if (params.value === undefined) {
            return (
               <div className="flex items-center justify-center h-full">
                  <Loader2 className="animate-spin" />
               </div>
            );
         }
         return params.value;
      },
   },
   {
      field: "Size",
      headerName: "Size",
      flex: 1,
   },
   {
      field: "LastModified",
      headerName: "Modified",
      flex: 1,
      valueFormatter: (params) => {
         return new Date(params.value).toLocaleDateString();
      },
   },
];

type ObjectsProps = {
   bucket: string;
};

const Objects = ({ bucket }: ObjectsProps) => {
   const serverId = useSessionStore((state) => state.serverId);
   const blockSize = 1000;
   const objectDatasource = MakeObjectSource(bucket, blockSize, serverId);

   return (
      <GridProvider>
         <section className="flex flex-col p-8 w-full h-full">
            <div className="flex lg:flex-row flex-col pb-6 justify-between gap-2">
               <div className="flex gap-2">
                  {/* <QuickSearch className="flex-2/3" />
                  <Filter className="flex-1/3" /> */}
                  {/* <Pagination className="flex-1/3" /> */}
               </div>
            </div>
            <div className="flex flex-col flex-1 gap-2">
               <BaseGrid
                  datasource={objectDatasource}
                  colDefs={columns}
                  className="flex-1"
                  rowModel={{
                     type: "infinite",
                     cacheBlockSize: blockSize,
                     maxBlocksInCache: 10,
                  }}
               />
               {/* <PaginationControls /> */}
            </div>
         </section>
      </GridProvider>
   );
};

export default Objects;
