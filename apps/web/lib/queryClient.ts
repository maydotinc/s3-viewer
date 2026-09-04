import { ApiError } from "@/lib/api";
import { MINUTE_MS } from "@s3-viewer/types";
import { QueryClient } from "@tanstack/react-query";

const shouldRetry = (failureCount: number, error: unknown): boolean => {
   if (error instanceof ApiError && error.status >= 400 && error.status < 500)
      return false;
   return failureCount < 1;
};

const createQueryClient = (): QueryClient =>
   new QueryClient({
      defaultOptions: {
         queries: {
            staleTime: 5 * MINUTE_MS,
            retry: shouldRetry,
            refetchOnWindowFocus: false,
            // Error states render their own "Try again". Without this, an
            // error view that subscribes to the failed query (e.g. through
            // usePermission → useBuckets) would refetch on mount, flip the
            // query back to pending, unmount itself, and loop forever.
            retryOnMount: false,
         },
      },
   });

let browserClient: QueryClient | null = null;

/**
 * One client per browser session. Creating it inside a React state
 * initialiser is not enough: strict mode double-invokes the initialiser, so
 * a module-level "last created" reference would point at a client React
 * never mounted, and `clearQueryCache` would clear the wrong cache.
 */
const getQueryClient = (): QueryClient => {
   if (typeof window === "undefined") return createQueryClient();
   browserClient ??= createQueryClient();
   return browserClient;
};

const clearQueryCache = (): void => {
   browserClient?.clear();
};

export { clearQueryCache, getQueryClient };
