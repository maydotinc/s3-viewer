import {
   GRID_CARD,
   useGridPaginationContext,
} from "@/components/DataGrid/context";
import { LazyGrid } from "@/components/DataGrid/lazy-grid";
import { EmptyState } from "@/components/DataGrid/overlays";
import GridPagination from "@/components/DataGrid/page-controls";
import { Page, PageHeader } from "@/components/Layout/page";
import SignInPrompt from "@/components/Session/sign-in-prompt";
import { authClient } from "@/lib/auth";
import usePreferencesStore from "@/lib/stores/preferencesStore";
import useSessionStore from "@/lib/stores/sessionStore";
import { MAX_LIST_BLOCK_SIZE } from "@s3-viewer/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { useBucketContext, useBucketFilter } from "./Context";
import BucketHeader from "./header";
import {
   objectColumns,
   objectRowId,
   type ObjectGridContext,
} from "./Grid/columns";
import { failureOf, pinFailure, type ListFailure } from "./Grid/list-failure";
import {
   createObjectDatasource,
   type ObjectDatasource,
} from "./Grid/object-source";
import { objectRowSelection } from "./Grid/selection";
import ObjectsToolbar from "./toolbar";
import useObjectCommands from "./useObjectCommands";
import DropZone from "./Upload/drop-zone";
import { UploadProvider } from "./Upload/provider";
import BucketUnavailable from "./unavailable";

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
   const { data: session, isPending: isSessionPending } =
      authClient.useSession();
   const serverId = useSessionStore((state) => state.serverId);
   const foldersFirst = usePreferencesStore((state) => state.foldersFirst);
   const {
      bucketName,
      prefix,
      refresh,
      registerRefresh,
      notFound,
      bucketsError,
      isRefreshing,
   } = useBucketContext();
   const { filter } = useBucketFilter();
   const { gridRef, clearSelection } = useGridPaginationContext();
   const commands = useObjectCommands(bucketName);
   const [failure, setFailure] = useState<ListFailure<ObjectDatasource> | null>(
      null
   );
   const [retrying, setRetrying] = useState(false);
   const listPrefix = `${prefix}${filter}`;
   // tracked in an effect, not inside usememo: strict mode runs the memo twice
   // and keeps the first result.
   const latest = useRef<ObjectDatasource | null>(null);

   const datasource = useMemo(() => {
      const source: ObjectDatasource = createObjectDatasource({
         serverId,
         bucketName,
         prefix: listPrefix,
         foldersFirst,
         getGridApi: () => gridRef.current?.api,
         onError: (error) =>
            setFailure((prev) =>
               pinFailure(prev, latest.current, source, error)
            ),
      });
      return source;
   }, [serverId, bucketName, listPrefix, foldersFirst, gridRef]);

   const error = bucketsError ?? failureOf(failure, datasource);

   useEffect(() => {
      latest.current = datasource;
      clearSelection();
      gridRef.current?.api?.paginationGoToFirstPage();
   }, [datasource, clearSelection, gridRef]);

   useEffect(() => {
      registerRefresh(() => {
         const api = gridRef.current?.api;
         if (api) {
            datasource.reset();
            api.deselectAll();
            api.purgeInfiniteCache();
            return;
         }
         // grid hidden behind an error: prove the first page loads before
         // showing it again, so "try again" has an in-flight state.
         setRetrying(true);
         datasource
            .prime()
            .then(
               () => setFailure(null),
               (cause: unknown) =>
                  setFailure((prev) =>
                     pinFailure(prev, latest.current, datasource, cause)
                  )
            )
            .finally(() => setRetrying(false));
      });
      return () => registerRefresh(null);
   }, [registerRefresh, datasource, gridRef]);

   const gridContext = useMemo<ObjectGridContext>(
      () => ({ bucketName, prefix, commands }),
      [bucketName, prefix, commands]
   );

   if (!session && !isSessionPending)
      return <SignInPrompt>Sign in to view your objects.</SignInPrompt>;

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
                  retrying={isRefreshing || retrying}
               />
            </div>
         </Page>
      );

   return (
      <UploadProvider>
         <Page>
            <PageHeader>
               <BucketHeader />
            </PageHeader>
            <ObjectsToolbar />
            <div className={GRID_CARD}>
               {error ? (
                  <BucketUnavailable
                     bucketName={bucketName}
                     error={error}
                     failedAt={bucketsError ? "buckets" : "objects"}
                     onRetry={refresh}
                     retrying={isRefreshing || retrying}
                  />
               ) : (
                  <>
                     <DropZone className="flex min-h-0 flex-1 flex-col">
                        <LazyGrid
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
                     <GridPagination />
                  </>
               )}
            </div>
         </Page>
      </UploadProvider>
   );
};

export default Objects;
