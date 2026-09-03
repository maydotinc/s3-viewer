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
import { Page, PageHeader } from "@/components/Layout/page";
import SignInPrompt from "@/components/Session/sign-in-prompt";
import { ApiError } from "@/lib/api";
import { authClient } from "@/lib/auth";
import useBuckets from "@/lib/hooks/queries/s3/useBuckets";
import useServers from "@/lib/hooks/queries/server/useServers";
import useSessionStore from "@/lib/stores/sessionStore";
import { isCredentialsErrorCode } from "@s3-viewer/types";
import { Kbd } from "@s3-viewer/ui/components/kbd";
import { Folder, Search, ServerOff } from "lucide-react";
import { useId, useState } from "react";
import BucketActions from "./bucket-actions";
import { bucketColumns, bucketRowId } from "./bucket-columns";
import ServerInfo from "./header/server-info";

const NoBucketsOverlay = () => (
   <EmptyState
      icon={Folder}
      title="No buckets yet"
      description="Create a bucket, or ask an admin to give you access to one."
   />
);

/** Same anatomy as the objects toolbar's prefix search, so the two match. */
const BucketFilter = ({
   value,
   onChange,
}: {
   value: string;
   onChange: (v: string) => void;
}) => {
   const { gridReady } = useGridContext();
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
         {/* The key that focuses this field, shown only while it is idle. */}
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
