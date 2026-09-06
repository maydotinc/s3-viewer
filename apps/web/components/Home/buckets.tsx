import {
   GRID_CARD,
   GridProvider,
   useGridPaginationContext,
} from "@/components/DataGrid/context";
import { GridSkeleton, LazyGrid } from "@/components/DataGrid/lazy-grid";
import {
   CredentialsErrorState,
   EmptyState,
   GridErrorState,
   RetryButton,
} from "@/components/DataGrid/overlays";
import GridPagination from "@/components/DataGrid/page-controls";
import { Page, PageHeader } from "@/components/Layout/page";
import { ApiError } from "@/lib/api";
import useBuckets from "@/lib/hooks/queries/s3/useBuckets";
import useServers from "@/lib/hooks/queries/server/useServers";
import { usePermission } from "@/lib/hooks/usePermission";
import useSessionStore from "@/lib/stores/sessionStore";
import { Permission } from "@s3-viewer/permissions";
import { isCredentialsErrorCode } from "@s3-viewer/types";
import { Kbd } from "@s3-viewer/ui/components/kbd";
import { Folder, Search, ServerOff } from "lucide-react";
import { useId, useMemo, useState } from "react";
import BucketActions from "./bucket-actions";
import {
   bucketColumns,
   bucketRowId,
   type BucketGridContext,
} from "./bucket-columns";
import ServerInfo from "./header/server-info";

const NoBucketsOverlay = () => (
   <EmptyState
      icon={Folder}
      title="No buckets yet"
      description="Create a bucket, or ask an admin to give you access to one."
   />
);

const BucketFilter = ({
   value,
   onChange,
}: {
   value: string;
   onChange: (v: string) => void;
}) => {
   const { gridReady } = useGridPaginationContext();
   const [focused, setFocused] = useState(false);
   const inputId = useId();

   return (
      <div className="relative flex h-9 w-full min-w-0 items-center sm:w-72 sm:shrink-0">
         <label htmlFor={inputId} className="sr-only">
            Filter buckets
         </label>
         <Search
            className="pointer-events-none absolute left-3 z-10 size-4 shrink-0 text-viewerlighttext"
            aria-hidden="true"
         />
         <input
            id={inputId}
            type="text"
            disabled={!gridReady}
            placeholder="Filter buckets…"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoComplete="off"
            spellCheck={false}
            className="h-9 w-full min-w-0 rounded-lg border border-viewerborder bg-transparent py-1 pl-9 pr-9 text-sm text-viewerblack outline-none placeholder:text-viewerlighttext focus-visible:border-viewerblue disabled:cursor-not-allowed disabled:opacity-50"
         />
         {gridReady && !focused && !value && (
            <Kbd
               keys="/"
               className="pointer-events-none absolute right-3"
               aria-hidden="true"
            />
         )}
      </div>
   );
};

type RetryProps = { onRetry: () => void; retrying: boolean };

const BucketsError = ({
   error,
   onRetry,
   retrying,
}: { error: Error } & RetryProps) => {
   if (error instanceof ApiError && isCredentialsErrorCode(error.code)) {
      return (
         <CredentialsErrorState
            message={error.message}
            onRetry={onRetry}
            retrying={retrying}
         />
      );
   }

   return (
      <GridErrorState title="Couldn't load buckets" detail={error.message}>
         <RetryButton onRetry={onRetry} retrying={retrying} />
      </GridErrorState>
   );
};

const BucketsPanel = ({ filter }: { filter: string }) => {
   const serverId = useSessionStore((state) => state.serverId);
   const { isServerListLoading } = useServers();
   const { buckets, isBucketsLoading, bucketsError, isFetching, refetch } =
      useBuckets();
   const canRemove = usePermission(Permission.DELETE_BUCKET);
   const gridContext = useMemo<BucketGridContext>(
      () => ({ canRemove }),
      [canRemove]
   );

   if (bucketsError && !isBucketsLoading) {
      return (
         <div className={GRID_CARD}>
            <BucketsError
               error={bucketsError}
               retrying={isFetching}
               onRetry={() => void refetch()}
            />
         </div>
      );
   }

   return (
      <div className={GRID_CARD}>
         {isServerListLoading || isBucketsLoading ? (
            <GridSkeleton columns={bucketColumns} />
         ) : !serverId ? (
            <EmptyState
               icon={ServerOff}
               title="No server selected"
               description="Connect a server or pick one from the sidebar to see its buckets."
            />
         ) : (
            <LazyGrid
               rowModel="clientSide"
               rowData={buckets}
               quickFilterText={filter}
               columnDefs={bucketColumns}
               getRowId={bucketRowId}
               context={gridContext}
               noRowsOverlayComponent={NoBucketsOverlay}
            />
         )}
         <GridPagination />
      </div>
   );
};

const Buckets = () => {
   const [filter, setFilter] = useState("");

   return (
      <GridProvider>
         <Page>
            <PageHeader title="Buckets" actions={<ServerInfo />} />
            <div className="flex min-h-9 shrink-0 flex-wrap items-center gap-2">
               <BucketFilter value={filter} onChange={setFilter} />
               <BucketActions />
            </div>
            <BucketsPanel filter={filter} />
         </Page>
      </GridProvider>
   );
};

export default Buckets;
