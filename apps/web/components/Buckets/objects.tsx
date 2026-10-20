import { GRID_CARD } from "@/components/DataGrid/context";
import { LazyGrid } from "@/components/DataGrid/lazy-grid";
import { EmptyState } from "@/components/DataGrid/overlays";
import GridPagination from "@/components/DataGrid/page-controls";
import { FittedGridSkeleton } from "@/components/DataGrid/skeleton";
import { Page, PageHeader } from "@/components/Layout/page";
import { changeReaches, onListingChanged } from "@/lib/listing-events";
import { queryKeys } from "@/lib/query-keys";
import usePreferencesStore from "@/lib/stores/preferences-store";
import { canListPrefix, folderAccessAt } from "@/lib/utils/folder-access";
import { useServerId } from "@/lib/stores/session-scope";
import { useUserId } from "@/lib/stores/session-store";
import { DOT_SEGMENTS_MESSAGE, MAX_LIST_BLOCK_SIZE } from "@s3-viewer/types";
import { useQueryClient } from "@tanstack/react-query";
import type { GridApi } from "ag-grid-community";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBucketContext, useBucketFilter } from "./Context";
import BucketHeader from "./header";
import { objectColumns, objectRowId } from "@/components/Buckets/Grid/columns";
import {
   ObjectGridStateProvider,
   type ObjectGridState,
} from "@/components/Buckets/Grid/grid-state";
import {
   createObjectDatasource,
   prefetchFirstBlock,
} from "@/components/Buckets/Grid/object-source";
import { objectRowSelection } from "@/components/Buckets/Grid/selection";
import ObjectsToolbar from "./toolbar";
import {
   ObjectCommandsProvider,
   useCreateObjectCommands,
} from "./useObjectCommands";
import DropZone from "@/components/Buckets/Upload/drop-zone";
import { UploadProvider } from "@/components/Buckets/Upload/provider";
import BucketUnavailable from "./unavailable";
import {
   DottedPath,
   FolderAccessNotice,
   NoFolderAccess,
} from "./folder-access";

const NoObjectsOverlay = () => {
   const { filter } = useBucketFilter();
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

const Objects = () => {
   const queryClient = useQueryClient();
   const userId = useUserId();
   const serverId = useServerId();
   const foldersFirst = usePreferencesStore((state) => state.foldersFirst);
   const {
      bucketName,
      prefix,
      reach,
      awaitingReach,
      refresh,
      registerRefresh,
      setListingReloading,
      notFound,
      bucketsError,
      isRefreshing,
   } = useBucketContext();
   const { filter } = useBucketFilter();
   const commands = useCreateObjectCommands(bucketName);
   const [failure, setFailure] = useState<{
      listingKey: string;
      error: unknown;
   } | null>(null);
   const source = useRef<ReturnType<typeof createObjectDatasource> | null>(
      null
   );
   const listingScope = useRef({ serverId, bucketName, prefix });
   listingScope.current = { serverId, bucketName, prefix };
   const listPrefix = `${prefix}${filter}`;
   const listingKey = JSON.stringify([
      serverId,
      bucketName,
      listPrefix,
      foldersFirst,
   ]);
   const error =
      bucketsError ??
      (failure?.listingKey === listingKey ? failure.error : null);
   const access = folderAccessAt(reach, prefix);
   const listable =
      !error &&
      access !== "dotted" &&
      access !== "outside" &&
      !awaitingReach &&
      canListPrefix(reach, listPrefix);
   const firstBlock = useMemo(
      () => prefetchFirstBlock({ serverId, bucketName, prefix: listPrefix }),
      [serverId, bucketName, listPrefix]
   );

   useEffect(() => {
      if (!listable) return;
      firstBlock.start();
      return firstBlock.cancel;
   }, [firstBlock, listable]);

   useEffect(() => {
      const reload = () => {
         setFailure(null);
         if (!source.current) return;
         setListingReloading(true);
         source.current.reload();
      };
      registerRefresh(reload);
      const stopListening = onListingChanged((change) => {
         if (changeReaches(change, listingScope.current)) reload();
      });
      return () => {
         registerRefresh(null);
         stopListening();
         setListingReloading(false);
      };
   }, [registerRefresh, setListingReloading]);

   const createDatasource = useCallback(
      (api: GridApi) => {
         const datasource = createObjectDatasource({
            serverId,
            bucketName,
            prefix: listPrefix,
            foldersFirst,
            firstBlock: firstBlock.take(),
            getGridApi: () => api,
            onError: (error) => setFailure({ listingKey, error }),
            onReloaded: () => setListingReloading(false),
            onFirstPage: (keys) =>
               queryClient.setQueryData(
                  queryKeys.objectKeySuggestions(
                     userId,
                     serverId,
                     bucketName,
                     listPrefix
                  ),
                  keys
               ),
         });
         source.current = datasource;
         return datasource;
      },
      [
         serverId,
         bucketName,
         listPrefix,
         foldersFirst,
         firstBlock,
         listingKey,
         queryClient,
         userId,
         setListingReloading,
      ]
   );

   const gridState = useMemo<ObjectGridState>(
      () => ({ bucketName, prefix, reach, commands }),
      [bucketName, prefix, reach, commands]
   );

   if (notFound)
      return (
         <Page>
            <PageHeader>
               <BucketHeader />
            </PageHeader>
            <div className={GRID_CARD}>
               <BucketUnavailable
                  bucketName={bucketName}
                  onRetry={refresh}
                  retrying={isRefreshing}
               />
            </div>
         </Page>
      );

   return (
      <ObjectCommandsProvider value={commands}>
         <UploadProvider>
            <Page>
               <PageHeader>
                  <BucketHeader />
               </PageHeader>
               <ObjectsToolbar />
               <div className={GRID_CARD}>
                  {error ? (
                     <>
                        <BucketUnavailable
                           bucketName={bucketName}
                           error={error}
                           failedAt={bucketsError ? "buckets" : "objects"}
                           onRetry={refresh}
                           retrying={isRefreshing}
                        />
                        <FolderAccessNotice />
                     </>
                  ) : access === "dotted" || access === "outside" ? (
                     <DropZone className="flex min-h-0 flex-1 flex-col">
                        {access === "dotted" ? (
                           <DottedPath />
                        ) : (
                           <NoFolderAccess
                              bucketName={bucketName}
                              folders={reach?.folders ?? []}
                              onRetry={refresh}
                              retrying={isRefreshing}
                           />
                        )}
                     </DropZone>
                  ) : !listable && reach ? (
                     <>
                        <DropZone className="flex min-h-0 flex-1 flex-col">
                           <EmptyState
                              title="No matching objects"
                              description={DOT_SEGMENTS_MESSAGE}
                           />
                        </DropZone>
                        <FolderAccessNotice />
                     </>
                  ) : !listable ? (
                     <>
                        <DropZone className="flex min-h-0 flex-1 flex-col">
                           <FittedGridSkeleton columns={objectColumns} />
                        </DropZone>
                        <GridPagination />
                     </>
                  ) : (
                     <ObjectGridStateProvider value={gridState}>
                        <DropZone className="flex min-h-0 flex-1 flex-col">
                           <LazyGrid
                              key={listingKey}
                              rowModel="infinite"
                              createDatasource={createDatasource}
                              cacheBlockSize={MAX_LIST_BLOCK_SIZE}
                              columnDefs={objectColumns}
                              getRowId={objectRowId}
                              rowSelection={objectRowSelection}
                              noRowsOverlayComponent={NoObjectsOverlay}
                           />
                        </DropZone>
                        {/* below the grid, so its late arrival shrinks the viewport instead of pushing the rows down */}
                        <FolderAccessNotice />
                        <GridPagination />
                     </ObjectGridStateProvider>
                  )}
               </div>
            </Page>
         </UploadProvider>
      </ObjectCommandsProvider>
   );
};

export default Objects;
