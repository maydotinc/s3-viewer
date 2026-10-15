import useFileDropGuard from "@/components/Buckets/useFileDropGuard";
import useBuckets from "@/lib/hooks/queries/s3/useBuckets";
import useServers from "@/lib/hooks/queries/server/useServers";
import { authClient } from "@/lib/auth";
import { queryKeys } from "@/lib/query-keys";
import { useServerId } from "@/lib/stores/session-scope";
import { useUserId } from "@/lib/stores/session-store";
import { reachOf, type KnownReach } from "@/lib/utils/folder-access";
import { prefixFromSegments } from "@/lib/utils/s3/paths";
import { Role } from "@s3-viewer/types";
import { useQueryClient } from "@tanstack/react-query";
import {
   createContext,
   useCallback,
   useContext,
   useMemo,
   useRef,
   useState,
   type ReactNode,
} from "react";

type BucketContextValue = {
   bucketName: string;
   reach: KnownReach;
   awaitingReach: boolean;
   path: string[];
   prefix: string;
   isLoading: boolean;
   bucketsError: Error | null;
   isRefreshing: boolean;
   notFound: boolean;
   refresh: () => void;
   reloadListing: () => void;
   registerRefresh: (handler: (() => void) | null) => void;
   setListingReloading: (reloading: boolean) => void;
};

type BucketFilterContextValue = {
   filter: string;
   setFilter: (filter: string) => void;
};

const BucketContext = createContext<BucketContextValue | null>(null);
const BucketFilterContext = createContext<BucketFilterContextValue | null>(
   null
);

type BucketProviderProps = {
   bucketName: string;
   path: string[];
   children: ReactNode;
};

const BucketProvider = ({
   bucketName,
   path,
   children,
}: BucketProviderProps) => {
   const { data: session } = authClient.useSession();
   const queryClient = useQueryClient();
   const userId = useUserId();
   const serverId = useServerId();
   const { servers, currentServer, isLoading: isServersLoading } = useServers();
   const {
      currentBucket,
      isBucketsLoading,
      bucketsError,
      isFetching: isBucketsFetching,
      refetch: refetchBuckets,
   } = useBuckets(bucketName);
   const prefix = prefixFromSegments(path);
   const isSettling =
      (Boolean(session) && !userId) || (servers.length > 0 && !serverId);
   const isLoading = isServersLoading || isSettling || isBucketsLoading;
   const isOwner = currentServer?.userRole === Role.OWNER;
   const scope = JSON.stringify([bucketName, prefix]);
   const [filterState, setFilterState] = useState({ scope, text: "" });
   if (filterState.scope !== scope) setFilterState({ scope, text: "" });
   const filter = filterState.scope === scope ? filterState.text : "";
   const currentScope = useRef(scope);
   currentScope.current = scope;
   const setFilter = useCallback(
      (text: string) => setFilterState({ scope: currentScope.current, text }),
      []
   );
   const refreshHandler = useRef<(() => void) | null>(null);
   const [listingReloading, setListingReloading] = useState(false);
   useFileDropGuard();

   const reloadListing = useCallback(() => refreshHandler.current?.(), []);
   const refresh = useCallback(() => {
      void refetchBuckets();
      void queryClient.invalidateQueries({
         queryKey: queryKeys.serverInfo(userId, serverId),
      });
      reloadListing();
   }, [refetchBuckets, reloadListing, queryClient, userId, serverId]);
   const registerRefresh = useCallback((handler: (() => void) | null) => {
      refreshHandler.current = handler;
   }, []);

   const value = useMemo<BucketContextValue>(
      () => ({
         bucketName,
         reach: isLoading ? undefined : reachOf(currentBucket),
         awaitingReach: isLoading && !isOwner,
         path,
         prefix,
         isLoading,
         bucketsError,
         isRefreshing:
            (isBucketsFetching && !isBucketsLoading) || listingReloading,
         notFound:
            !isLoading &&
            !bucketsError &&
            Boolean(bucketName) &&
            !currentBucket,
         refresh,
         reloadListing,
         registerRefresh,
         setListingReloading,
      }),
      [
         bucketName,
         currentBucket,
         path,
         prefix,
         isLoading,
         isOwner,
         bucketsError,
         isBucketsFetching,
         isBucketsLoading,
         listingReloading,
         refresh,
         reloadListing,
         registerRefresh,
      ]
   );

   const filterValue = useMemo<BucketFilterContextValue>(
      () => ({ filter, setFilter }),
      [filter, setFilter]
   );

   return (
      <BucketContext.Provider value={value}>
         <BucketFilterContext.Provider value={filterValue}>
            {children}
         </BucketFilterContext.Provider>
      </BucketContext.Provider>
   );
};

const useBucketContext = () => {
   const context = useContext(BucketContext);
   if (!context)
      throw new Error("useBucketContext must be used within a BucketProvider");
   return context;
};

const useBucketFilter = () => {
   const context = useContext(BucketFilterContext);
   if (!context)
      throw new Error("useBucketFilter must be used within a BucketProvider");
   return context;
};

export { BucketProvider, useBucketContext, useBucketFilter };
