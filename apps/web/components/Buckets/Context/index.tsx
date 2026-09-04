import useBuckets from "@/lib/hooks/queries/s3/useBuckets";
import useServers from "@/lib/hooks/queries/server/useServers";
import { authClient } from "@/lib/auth";
import useSessionStore, { useUserId } from "@/lib/stores/sessionStore";
import { prefixFromSegments } from "@/lib/utils/s3/paths";
import type { S3Bucket } from "@s3-viewer/types";
import {
   createContext,
   useCallback,
   useContext,
   useEffect,
   useMemo,
   useRef,
   useState,
} from "react";

type BucketContextValue = {
   bucketName: string;
   bucket: S3Bucket | null;
   path: string[];
   prefix: string;
   isLoading: boolean;
   bucketsError: Error | null;
   isRefreshing: boolean;
   notFound: boolean;
   refresh: () => void;
   registerRefresh: (handler: (() => void) | null) => void;
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
   children: React.ReactNode;
};

const BucketProvider = ({
   bucketName,
   path,
   children,
}: BucketProviderProps) => {
   const { data: session } = authClient.useSession();
   const userId = useUserId();
   const serverId = useSessionStore((state) => state.serverId);
   const { servers, isLoading: isServersLoading } = useServers();
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
   const [filter, setFilter] = useState("");
   const refreshHandler = useRef<(() => void) | null>(null);

   useEffect(() => {
      setFilter("");
   }, [bucketName, prefix]);

   const refresh = useCallback(() => {
      void refetchBuckets();
      refreshHandler.current?.();
   }, [refetchBuckets]);
   const registerRefresh = useCallback((handler: (() => void) | null) => {
      refreshHandler.current = handler;
   }, []);

   const value = useMemo<BucketContextValue>(
      () => ({
         bucketName,
         bucket: currentBucket ?? null,
         path,
         prefix,
         isLoading,
         bucketsError,
         isRefreshing: isBucketsFetching && !isBucketsLoading,
         notFound:
            !isLoading &&
            !bucketsError &&
            Boolean(bucketName) &&
            !currentBucket,
         refresh,
         registerRefresh,
      }),
      [
         bucketName,
         currentBucket,
         path,
         prefix,
         isLoading,
         bucketsError,
         isBucketsFetching,
         isBucketsLoading,
         refresh,
         registerRefresh,
      ]
   );

   const filterValue = useMemo<BucketFilterContextValue>(
      () => ({ filter, setFilter }),
      [filter]
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
