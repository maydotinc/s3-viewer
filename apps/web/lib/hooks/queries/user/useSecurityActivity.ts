import { api, qs } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useUserId } from "@/lib/stores/sessionStore";
import type {
   AuditAction,
   AuditLogEntry,
   AuditLogPage,
} from "@s3-viewer/types";
import { useInfiniteQuery } from "@tanstack/react-query";

const PAGE_SIZE = 20;

// shared instance: an inline `= []` default would be a new array every render
// and re-trigger every memo and effect depending on it.
const NO_ENTRIES: AuditLogEntry[] = [];

// /account/audit is the caller's whole trail, server actions included; this
// card is about the account itself, so the rest is left to the server's own
// activity tab. the filter is client-side because a page is what paginates:
// the endpoint keeps one cursor contract for both readers
const SECURITY_ACTIONS: ReadonlySet<AuditAction> = new Set<AuditAction>([
   "auth.sign_in",
   "auth.sign_in_failed",
   "auth.sign_up",
   "auth.sign_out",
   "auth.password_change",
   "auth.password_reset",
   "auth.password_set",
   "auth.sessions_revoked",
   "account.verify",
]);

const useSecurityActivity = () => {
   const userId = useUserId();

   const query = useInfiniteQuery({
      queryKey: queryKeys.securityActivity(userId),
      queryFn: ({ pageParam }) =>
         api.get<AuditLogPage>(
            `/account/audit${qs({ cursor: pageParam, limit: PAGE_SIZE })}`
         ),
      initialPageParam: null as string | null,
      getNextPageParam: (page: AuditLogPage) => page.nextCursor,
      enabled: Boolean(userId),
   });

   return {
      entries: query.data
         ? query.data.pages
              .flatMap((page) => page.entries)
              .filter((entry) => SECURITY_ACTIONS.has(entry.action))
         : NO_ENTRIES,
      isLoading: query.isLoading,
      error: query.error,
      hasNextPage: query.hasNextPage,
      isFetchingNextPage: query.isFetchingNextPage,
      fetchNextPage: query.fetchNextPage,
   };
};

export default useSecurityActivity;
export { PAGE_SIZE, SECURITY_ACTIONS };
