import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { useUserId } from "@/lib/stores/session-store";
import type { AccountSummary } from "@s3-viewer/types";
import { useQuery } from "@tanstack/react-query";

const useAccountSummary = () => {
   const userId = useUserId();
   return useQuery({
      queryKey: queryKeys.accountSummary(userId),
      queryFn: ({ signal }) =>
         api.get<AccountSummary>("/account/summary", signal),
      enabled: Boolean(userId),
      staleTime: 0,
   });
};

export { useAccountSummary };
