import { GridProvider, useGridContext } from "@/components/DataGrid/context";
import { GridSkeleton, LazyGrid } from "@/components/DataGrid/lazy-grid";
import { EmptyState, LoadError } from "@/components/DataGrid/overlays";
import PageControls from "@/components/DataGrid/page-controls";
import PageSize from "@/components/DataGrid/page-size";
import SignInPrompt from "@/components/Session/sign-in-prompt";
import { authClient } from "@/lib/auth";
import useBuckets from "@/lib/hooks/queries/s3/useBuckets";
import useServers from "@/lib/hooks/queries/server/useServers";
import useSessionStore from "@/lib/stores/sessionStore";
import { Search } from "lucide-react";
import { useId, useState } from "react";
import BucketActions from "./bucket-actions";
import { bucketColumns, bucketRowId } from "./bucket-columns";

const NoBucketsOverlay = () => (
   <EmptyState
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
      <div className="relative flex min-w-56 flex-1 items-center">
         <label htmlFor={id} className="sr-only">
            Filter buckets
         </label>
         <Search
            className="pointer-events-none absolute left-3 size-4 text-viewerlighttext"
            aria-hidden="true"
         />
         <input
            id={id}
            type="text"
            placeholder="Filter buckets…"
            value={value}
            disabled={!gridReady}
            onChange={(event) => onChange(event.target.value)}
            autoComplete="off"
            className="h-9 w-full rounded-lg border border-viewerborder bg-transparent py-1 pl-9 pr-3 text-sm text-viewerblack outline-none placeholder:text-viewerlighttext focus-visible:ring-[3px] focus-visible:ring-viewerblue/40 disabled:cursor-not-allowed disabled:opacity-50"
         />
      </div>
   );
};

const BucketsGrid = ({ filter }: { filter: string }) => {
   const { data: session, isPending } = authClient.useSession();
   const serverId = useSessionStore((state) => state.serverId);
   const { isServerListLoading } = useServers();
   const { buckets, isBucketsLoading, bucketsError, isFetching, refetch } =
      useBuckets();

   if (!session && !isPending)
      return <SignInPrompt>Sign in to view your buckets.</SignInPrompt>;

   if (isPending || isServerListLoading || isBucketsLoading)
      return <GridSkeleton />;

   if (!serverId) {
      return (
         <EmptyState
            title="No server selected"
            description="Connect a server or pick one from the sidebar to see its buckets."
         />
      );
   }

   if (bucketsError) {
      return (
         <LoadError
            title="Couldn't load buckets"
            message={bucketsError.message}
            retrying={isFetching}
            onRetry={() => void refetch()}
         />
      );
   }

   return (
      <LazyGrid
         rowModel="clientSide"
         rowData={buckets}
         quickFilterText={filter}
         columnDefs={bucketColumns}
         getRowId={bucketRowId}
         noRowsOverlayComponent={NoBucketsOverlay}
      />
   );
};

const Buckets = () => {
   const [filter, setFilter] = useState("");

   return (
      <GridProvider>
         <section className="flex min-h-0 w-full flex-1 flex-col p-8 pt-6">
            <div className="flex flex-wrap items-center gap-2 pb-4">
               <BucketFilter value={filter} onChange={setFilter} />
               <PageSize />
               <BucketActions />
            </div>
            <BucketsGrid filter={filter} />
            <PageControls className="pt-2" />
         </section>
      </GridProvider>
   );
};

export default Buckets;
