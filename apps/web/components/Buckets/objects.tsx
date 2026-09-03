import { useGridContext } from "@/components/DataGrid/context";
import { LazyGrid } from "@/components/DataGrid/lazy-grid";
import { EmptyState, LoadError } from "@/components/DataGrid/overlays";
import PageControls from "@/components/DataGrid/page-controls";
import SignInPrompt from "@/components/Session/sign-in-prompt";
import { ApiError, errorMessage } from "@/lib/api";
import { authClient } from "@/lib/auth";
import useSessionStore from "@/lib/stores/sessionStore";
import { MAX_LIST_BLOCK_SIZE } from "@s3-viewer/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { useBucketContext } from "./Context";
import {
   objectColumns,
   objectRowId,
   type ObjectGridContext,
} from "./Grid/columns";
import {
   createObjectDatasource,
   type ObjectDatasource,
} from "./Grid/object-source";
import { objectRowSelection } from "./Grid/selection";
import ObjectsToolbar from "./toolbar";
import DropZone from "./Upload/drop-zone";
import { UploadProvider } from "./Upload/provider";
import BucketUnavailable from "./unavailable";

const NoObjectsOverlay = () => {
   const { filter } = useBucketContext();
   return filter ? (
      <EmptyState
         title="No matching objects"
         description="No objects match this prefix."
      />
   ) : (
      <EmptyState
         title="This folder is empty"
         description="Nothing has been uploaded here yet."
      />
   );
};

const isUnavailable = (error: unknown) =>
   error instanceof ApiError && (error.status === 403 || error.status === 404);

const Objects = () => {
   const { data: session, isPending: isSessionPending } =
      authClient.useSession();
   const serverId = useSessionStore((state) => state.serverId);
   const { bucketName, prefix, filter, refresh, registerRefresh, notFound } =
      useBucketContext();
   const { gridRef, clearSelection } = useGridContext();
   const [error, setError] = useState<unknown>(null);
   const listPrefix = `${prefix}${filter}`;
   const latest = useRef<ObjectDatasource | null>(null);

   const datasource = useMemo(() => {
      const source: ObjectDatasource = createObjectDatasource({
         serverId,
         bucketName,
         prefix: listPrefix,
         getGridApi: () => gridRef.current?.api,
         onError: (cause) => {
            if (latest.current === source) setError(cause);
         },
      });
      latest.current = source;
      return source;
   }, [serverId, bucketName, listPrefix, gridRef]);

   useEffect(() => {
      setError(null);
      clearSelection();
      gridRef.current?.api?.paginationGoToFirstPage();
   }, [datasource, clearSelection, gridRef]);

   useEffect(() => {
      registerRefresh(() => {
         setError(null);
         datasource.reset();
         const api = gridRef.current?.api;
         api?.deselectAll();
         api?.purgeInfiniteCache();
      });
      return () => registerRefresh(null);
   }, [registerRefresh, datasource, gridRef]);

   const gridContext = useMemo<ObjectGridContext>(
      () => ({ bucketName, prefix }),
      [bucketName, prefix]
   );

   if (!session && !isSessionPending)
      return <SignInPrompt>Sign in to view your objects.</SignInPrompt>;

   if (notFound || isUnavailable(error))
      return <BucketUnavailable bucketName={bucketName} />;

   return (
      <UploadProvider>
         <section className="flex min-h-0 w-full flex-1 flex-col p-8 pt-6">
            <ObjectsToolbar />
            {error ? (
               <LoadError
                  title="Couldn't load objects"
                  message={errorMessage(error)}
                  onRetry={refresh}
               />
            ) : (
               <DropZone className="flex min-h-0 flex-1 flex-col">
                  <LazyGrid
                     className="fade-in"
                     rowModel="infinite"
                     datasource={datasource}
                     cacheBlockSize={MAX_LIST_BLOCK_SIZE}
                     columnDefs={objectColumns}
                     getRowId={objectRowId}
                     context={gridContext}
                     rowSelection={objectRowSelection}
                     noRowsOverlayComponent={NoObjectsOverlay}
                  />
               </DropZone>
            )}
            <PageControls className="pt-2" />
         </section>
      </UploadProvider>
   );
};

export default Objects;
