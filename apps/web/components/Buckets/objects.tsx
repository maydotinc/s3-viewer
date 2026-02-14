import useSessionStore from "@/lib/stores/sessionStore";
import { useCallback, useEffect, useMemo, useState } from "react";
import PaginationControls from "../DataGrid/Actions/page-controls";
import { useGridContext } from "../DataGrid/context";
import BaseGrid from "../DataGrid/grid";
import ObjectActions from "./Actions";
import { useBucketContext } from "./Context";
import GridActions from "./Grid/actions";
import columns from "./Grid/cols/columns";
import { rowSelection } from "./Grid/cols/selection-col";
import MakeObjectSource from "./Grid/object-source";
import useRemoveBucket from "@/lib/hooks/mutations/bucket/useRemoveBucket";
import { authClient } from "@s3-viewer/auth/client";
import { Button } from "@s3-viewer/ui/components/button";
import { ShieldX } from "lucide-react";
import { useRouter } from "next/router";

const Objects = () => {
   const router = useRouter();
   const { data: session, isPending } = authClient.useSession();
   const { path, bucket } = useBucketContext();
   const { gridRef, gridReady } = useGridContext();
   const serverId = useSessionStore((state) => state.serverId);
   const blockSize = 1000;
   const [error, setError] = useState<string | null>(null);
   const removeBucket = useRemoveBucket(serverId);

   const onFatalError = useCallback((message: string) => {
      setError(message);
   }, []);

   useEffect(() => {
      setError(null);
   }, [bucket?.Name, path.length, serverId]);

   const objectDatasource = useMemo(
      () =>
         MakeObjectSource(
            gridRef,
            bucket?.Name ?? "",
            path,
            blockSize,
            serverId,
            onFatalError
         ),
      [bucket?.Name, path.length, blockSize, serverId, gridReady]
   );

   useEffect(() => {
      if (gridReady && gridRef.current?.api && objectDatasource) {
         gridRef.current.api.setGridOption("datasource", objectDatasource);
      }
   }, [objectDatasource, gridReady]);

   if (isPending) return null;
   if (!session)
      return (
         <div className="flex flex-col items-center justify-center pt-24">
            <p className="text-sm text-viewertext">
               Login to view your objects
            </p>
         </div>
      );

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
            {error && (
               <div className="flex flex-col items-center justify-center flex-1 gap-3">
                  <ShieldX className="size-10 text-red-500" />
                  <h1 className="text-lg font-semibold text-viewerblack">
                     Access Denied
                  </h1>
                  <p className="text-sm text-viewertext max-w-md text-center">
                     You do not have permissions to access this bucket or this bucket does not exist.
                  </p>
                  <Button
                     variant="destructive"
                     size="sm"
                     disabled={removeBucket.isPending}
                     onClick={() => {
                        if (!bucket?.Name) return;
                        removeBucket.mutate(bucket.Name, {
                           onSuccess: () => router.push("/buckets"),
                        });
                     }}
                  >
                     {removeBucket.isPending ? "Removing..." : "Remove Bucket"}
                  </Button>
               </div>
            )}
            <div className={error ? "hidden" : "contents"}>
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
         </div>
      </section>
   );
};

export default Objects;
