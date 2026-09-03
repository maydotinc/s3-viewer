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
   /** The bucket list failed, so nothing under this server can load. */
   bucketsError: Error | null;
   /** A "Try again" is in flight. */
   isRefreshing: boolean;
   notFound: boolean;
   filter: string;
   setFilter: (filter: string) => void;
   refresh: () => void;
   registerRefresh: (handler: (() => void) | null) => void;
};

const BucketContext = createContext<BucketContextValue | null>(null);

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
         filter,
         setFilter,
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
         filter,
         refresh,
         registerRefresh,
      ]
   );

   return (
      <BucketContext.Provider value={value}>{children}</BucketContext.Provider>
   );
};

const useBucketContext = () => {
   const context = useContext(BucketContext);
   if (!context)
      throw new Error("useBucketContext must be used within a BucketProvider");
   return context;
};

export { BucketProvider, useBucketContext };
