import useSessionStore from "@/lib/stores/sessionStore";
import { useEffect, useMemo } from "react";
import Filter from "../DataGrid/Actions/filter";
import PaginationControls from "../DataGrid/Actions/page-controls";
import Pagination from "../DataGrid/Actions/pagination";
import PrefixSearch from "../DataGrid/Actions/prefix-search";
import { useGridContext } from "../DataGrid/context";
import BaseGrid from "../DataGrid/grid";
import ObjectActions from "./Actions";
import { useBucketContext } from "./Context";
import columns from "./Grid/cols/columns";
import MakeObjectSource from "./Grid/object-source";

const Objects = () => {
   const { path, bucket } = useBucketContext();
   const { gridRef, gridReady } = useGridContext();
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
      [bucket?.Name, path.length, blockSize, serverId, gridReady]
   );

   useEffect(() => {
      if (gridReady && gridRef.current?.api && objectDatasource) {
         gridRef.current.api.setGridOption("datasource", objectDatasource);
      }
   }, [objectDatasource, gridReady]);

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
      <section className="flex flex-col p-8 w-full h-full">
         <div className="flex lg:flex-row flex-col pb-6 justify-between gap-2">
            <div className="flex gap-2">
               <PrefixSearch className="flex-2/3" />
               <Filter className="flex-1/3" />
               <Pagination className="flex-1/3" />
            </div>
            <ObjectActions />
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
   );
};

export default Objects;
