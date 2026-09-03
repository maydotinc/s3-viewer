import {
   GRID_CARD,
   GridProvider,
   useGridContext,
} from "@/components/DataGrid/context";
import { GridSkeleton, LazyGrid } from "@/components/DataGrid/lazy-grid";
import {
   CredentialsErrorState,
   EmptyState,
   GridErrorState,
   RetryButton,
} from "@/components/DataGrid/overlays";
import GridPagination from "@/components/DataGrid/page-controls";
import SignInPrompt from "@/components/Session/sign-in-prompt";
import { ApiError } from "@/lib/api";
import { authClient } from "@/lib/auth";
import useBuckets from "@/lib/hooks/queries/s3/useBuckets";
import useServers from "@/lib/hooks/queries/server/useServers";
import useSessionStore from "@/lib/stores/sessionStore";
import { isCredentialsErrorCode } from "@s3-viewer/types";
import { Input } from "@s3-viewer/ui/components/input";
import { Folder, Search, ServerOff } from "lucide-react";
import { useId, useState } from "react";
import BucketActions from "./bucket-actions";
import { bucketColumns, bucketRowId } from "./bucket-columns";

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
   const { gridReady } = useGridContext();
   const id = useId();
   return (
      <div className="relative flex min-w-0 max-w-sm flex-1 items-center">
         <label htmlFor={id} className="sr-only">
            Filter buckets
         </label>
         <Search
            className="pointer-events-none absolute left-3 size-4 shrink-0 text-viewerlighttext"
            aria-hidden="true"
         />
         <Input
            id={id}
            type="text"
            placeholder="Filter buckets…"
            value={value}
            disabled={!gridReady}
            onChange={(event) => onChange(event.target.value)}
            autoComplete="off"
            className="border-viewerborder pl-9 text-sm text-viewerblack"
         />
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
   const { data: session, isPending } = authClient.useSession();
   const serverId = useSessionStore((state) => state.serverId);
   const { isServerListLoading } = useServers();
   const { buckets, isBucketsLoading, bucketsError, isFetching, refetch } =
      useBuckets();

   if (!session && !isPending)
      return <SignInPrompt>Sign in to view your buckets.</SignInPrompt>;

   // A failure fills the card on its own: there are no rows to paginate.
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
         {isPending || isServerListLoading || isBucketsLoading ? (
            <GridSkeleton />
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
         <section className="flex min-h-0 w-full flex-1 flex-col gap-4 p-6">
            <div className="flex h-9 items-center gap-2">
               <BucketFilter value={filter} onChange={setFilter} />
               <BucketActions />
            </div>
            <BucketsPanel filter={filter} />
         </section>
      </GridProvider>
   );
};

export default Buckets;
