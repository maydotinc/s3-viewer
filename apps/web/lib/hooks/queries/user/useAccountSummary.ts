import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useUserId } from "@/lib/stores/sessionStore";
import type { AccountSummary } from "@s3-viewer/types";
import { useQuery } from "@tanstack/react-query";

const useAccountSummary = () => {
   const userId = useUserId();
   return useQuery({
      queryKey: queryKeys.accountSummary(userId),
      queryFn: () => api.get<AccountSummary>("/account/summary"),
      enabled: Boolean(userId),
      staleTime: 0,
   });
};

export { useAccountSummary };
