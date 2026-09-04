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
            // error views render their own "try again"; refetching on mount
            // would flip the query back to pending, unmount the view, and loop.
            retryOnMount: false,
         },
      },
   });

let browserClient: QueryClient | null = null;

// not a react state initialiser: strict mode double-invokes it, so the
// module-level reference would point at a client react never mounted and
// `clearQueryCache` would clear the wrong cache.
const getQueryClient = (): QueryClient => {
   if (typeof window === "undefined") return createQueryClient();
   browserClient ??= createQueryClient();
   return browserClient;
};

const clearQueryCache = (): void => {
   browserClient?.clear();
};

export { clearQueryCache, getQueryClient };
