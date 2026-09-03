import { MINUTE_MS } from "@s3-viewer/types";
import { QueryClient } from "@tanstack/react-query";

let active: QueryClient | null = null;

const makeQueryClient = (): QueryClient => {
   active = new QueryClient({
      defaultOptions: {
         queries: {
            staleTime: 5 * MINUTE_MS,
            retry: 1,
            refetchOnWindowFocus: false,
         },
      },
   });
   return active;
};

const clearQueryCache = (): void => {
   active?.clear();
};

export { clearQueryCache, makeQueryClient };
