import {
   GRID_CARD,
   GridProvider,
   useGridPaginationContext,
} from "@/components/DataGrid/context";
import { LazyGrid } from "@/components/DataGrid/lazy-grid";
import { FittedGridSkeleton } from "@/components/DataGrid/skeleton";
import { EmptyState, GridLoadError } from "@/components/DataGrid/overlays";
import GridPagination from "@/components/DataGrid/page-controls";
import { Page, PageHeader, Toolbar } from "@/components/Layout/page";
import useBuckets from "@/lib/hooks/queries/s3/useBuckets";
import useCurrentServer from "@/lib/hooks/queries/server/useCurrentServer";
import { useServerId } from "@/lib/stores/session-scope";
import FilterInput from "@/components/filter-input";
import { Folder, ServerOff } from "lucide-react";
import { useState } from "react";
import BucketActions from "./bucket-actions";
import { bucketColumns, bucketRowId } from "./bucket-columns";
import ServerInfo from "@/components/Home/Header/server-info";

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
   onChange: (value: string) => void;
}) => {
   const { gridReady } = useGridPaginationContext();
   return (
      <FilterInput
         label="Filter buckets"
         className="sm:w-72 sm:shrink-0"
         shortcut={gridReady}
         disabled={!gridReady}
         placeholder="Filter buckets…"
         value={value}
         onChange={(event) => onChange(event.target.value)}
      />
   );
};

const BucketsPanel = ({ filter }: { filter: string }) => {
   const serverId = useServerId();
   const { isLoading: isServerLoading } = useCurrentServer();
   const { buckets, isBucketsLoading, bucketsError, isFetching, refetch } =
      useBuckets();

   if (bucketsError && !isBucketsLoading) {
      return (
         <div className={GRID_CARD}>
            <GridLoadError
               error={bucketsError}
               title="Couldn't load buckets"
               retrying={isFetching}
               onRetry={() => void refetch()}
            />
         </div>
      );
   }

   return (
      <div className={GRID_CARD}>
         {isServerLoading || isBucketsLoading ? (
            <FittedGridSkeleton columns={bucketColumns} />
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
            <Toolbar>
               <BucketFilter value={filter} onChange={setFilter} />
               <BucketActions />
            </Toolbar>
            <BucketsPanel filter={filter} />
         </Page>
      </GridProvider>
   );
};

export default Buckets;
