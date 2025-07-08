import useSessionStore from "@/lib/stores/sessionStore";
import { S3Object } from "@s3-viewer/types";
import { ColDef, ValueFormatterParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useEffect, useMemo, useRef } from "react";
import Filter from "../DataGrid/Actions/filter";
import PaginationControls from "../DataGrid/Actions/page-controls";
import Pagination from "../DataGrid/Actions/pagination";
import PrefixSearch from "../DataGrid/Actions/prefix-search";
import { GridProvider } from "../DataGrid/context";
import BaseGrid from "../DataGrid/grid";
import { useBucketContext } from "./Context/context";
import FolderCell from "./folder-cell";
import MakeObjectSource from "./object-source";

const columns: ColDef<S3Object>[] = [
   {
      field: "Key",
      headerName: "Name",
      flex: 2,
      cellRenderer: FolderCell,
      sortable: false,
      filter: "agTextColumnFilter",
      suppressHeaderFilterButton: true,
      suppressHeaderMenuButton: true,
      suppressFiltersToolPanel: true,
   },
   {
      field: "Size",
      headerName: "Size",
      flex: 1,
      sortable: false,
      valueFormatter: (params: ValueFormatterParams) => {
         if (!params.value) {
            return "";
         }
         if (params.value < 1024) {
            return `${params.value} B`;
         } else if (params.value < 1024 * 1024) {
            return `${(params.value / 1024).toFixed(2)} KB`;
         } else if (params.value < 1024 * 1024 * 1024) {
            return `${(params.value / 1024 / 1024).toFixed(2)} MB`;
         } else if (params.value < 1024 * 1024 * 1024 * 1024) {
            return `${(params.value / 1024 / 1024 / 1024).toFixed(2)} GB`;
         }
         return `${(params.value / 1024 / 1024 / 1024 / 1024).toFixed(2)} TB`;
      },
   },
   {
      field: "LastModified",
      headerName: "Modified",
      flex: 1,
      valueFormatter: (params: ValueFormatterParams) => {
         if (!params.value) {
            return "";
         }
         return new Date(params.value).toLocaleDateString();
      },
      sortable: false,
   },
];

const Objects = () => {
   const { path, bucket } = useBucketContext();
   const gridRef = useRef<AgGridReact>(null);
   const serverId = useSessionStore((state) => state.serverId);
   const blockSize = 1000;

   const objectDatasource = useMemo(
      () =>
         MakeObjectSource(
            gridRef,
            bucket?.Name ?? "",
            path,
            blockSize,
            serverId
         ),
      [bucket?.Name, path.length, blockSize, serverId]
   );

   const handleGridReady = () => {
      if (gridRef.current?.api && objectDatasource) {
         gridRef.current.api.setGridOption("datasource", objectDatasource);
      }
   };

   useEffect(() => {
      if (gridRef.current?.api && objectDatasource) {
         gridRef.current.api.setGridOption("datasource", objectDatasource);
      }
   }, [objectDatasource]);

   const noRowsOverlayComponent = () => {
      return (
         <div className="flex flex-col items-center justify-center h-full">
            <h1 className="text-2xl font-bold text-viewerblack">
               No objects found
            </h1>
            <p className="text-sm text-viewertext">
               This bucket is empty or no objects match your search.
            </p>
         </div>
      );
   };

   return (
      <GridProvider customGridRef={gridRef} onGridReady={handleGridReady}>
         <section className="flex flex-col p-8 w-full h-full">
            <div className="flex lg:flex-row flex-col pb-6 justify-between gap-2">
               <div className="flex gap-2">
                  <PrefixSearch className="flex-2/3" />
                  <Filter className="flex-1/3" />
                  <Pagination className="flex-1/3" />
               </div>
            </div>
            <div className="flex flex-col flex-1 gap-2">
               <BaseGrid
                  colDefs={columns}
                  className="flex-1"
                  rowModel={{
                     type: "infinite",
                     cacheBlockSize: blockSize,
                     maxBlocksInCache: 10,
                  }}
                  noRowsOverlayComponent={noRowsOverlayComponent}
                  routeContext={{
                     bucketName: bucket?.Name ?? "",
                     path,
                  }}
               />
               <PaginationControls />
            </div>
         </section>
      </GridProvider>
   );
};

export default Objects;
