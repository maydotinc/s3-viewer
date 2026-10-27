import { ApiError, setAccessRefusalHandler } from "./api";
import { isBucketsKey, isServerInfoKey } from "./query-keys";
import { MINUTE_MS } from "@s3-viewer/shared";
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
            // error views render their own retry; refetching on mount would unmount them in a loop.
            retryOnMount: false,
         },
      },
   });

const refreshAccess = (queryClient: QueryClient) => {
   let pending = false;
   return (): void => {
      if (pending) return;
      pending = true;
      void queryClient
         .invalidateQueries({
            predicate: ({ queryKey }) =>
               isBucketsKey(queryKey) || isServerInfoKey(queryKey),
         })
         .finally(() => {
            pending = false;
         });
   };
};

let browserClient: QueryClient | null = null;

// a module singleton, so strict mode double-invoking the useState initialiser in _app still yields one client.
const getQueryClient = (): QueryClient => {
   if (typeof window === "undefined") return createQueryClient();
   if (!browserClient) {
      browserClient = createQueryClient();
      setAccessRefusalHandler(refreshAccess(browserClient));
   }
   return browserClient;
};

const clearQueryCache = (): void => {
   browserClient?.clear();
};

export { clearQueryCache, getQueryClient, refreshAccess };
