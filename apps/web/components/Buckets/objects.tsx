import useSessionStore from "@/lib/stores/sessionStore";
import { useEffect, useMemo } from "react";
import PaginationControls from "../DataGrid/Actions/page-controls";
import { useGridContext } from "../DataGrid/context";
import BaseGrid from "../DataGrid/grid";
import ObjectActions from "./Actions";
import { useBucketContext } from "./Context";
import GridActions from "./Grid/actions";
import columns from "./Grid/cols/columns";
import { rowSelection } from "./Grid/cols/selection-col";
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
      <section className="flex flex-col p-8 pt-6 w-full h-full @container/actions">
         <div className="@max-3xl/actions:flex-col flex flex-row pb-6 justify-between gap-2">
            <GridActions />
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
               rowSelection={rowSelection}
            />
            <PaginationControls />
         </div>
      </section>
   );
};

export default Objects;
