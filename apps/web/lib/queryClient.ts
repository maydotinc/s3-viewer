import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
   defaultOptions: {
      queries: {
         refetchOnWindowFocus: true,
         refetchOnReconnect: true,
         staleTime: 1000 * 60 * 5,
      },
   },
});
