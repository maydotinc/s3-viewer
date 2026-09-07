import { api, qs, serverPath } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useUserId } from "@/lib/stores/sessionStore";
import type { AuditLogEntry, AuditLogPage } from "@s3-viewer/types";
import { useInfiniteQuery } from "@tanstack/react-query";

const PAGE_SIZE = 50;

// shared instance: an inline `= []` default would be a new array every render
// and re-trigger every memo and effect depending on it.
const NO_ENTRIES: AuditLogEntry[] = [];

// the endpoint needs MANAGE_MEMBERS, and the log is only ever looked at, so
// `enabled` keeps the request behind the tab that shows it
const useAuditLog = (serverId: string, enabled: boolean) => {
   const userId = useUserId();

   const query = useInfiniteQuery({
      queryKey: queryKeys.auditLog(userId, serverId),
      queryFn: ({ pageParam }) =>
         api.get<AuditLogPage>(
            `${serverPath(serverId)}/audit${qs({
               cursor: pageParam,
               limit: PAGE_SIZE,
            })}`
         ),
      initialPageParam: null as string | null,
      getNextPageParam: (page: AuditLogPage) => page.nextCursor,
      enabled: enabled && Boolean(userId && serverId),
   });

   return {
      entries: query.data
         ? query.data.pages.flatMap((page) => page.entries)
         : NO_ENTRIES,
      isLoading: query.isLoading,
      error: query.error,
      hasNextPage: query.hasNextPage,
      isFetchingNextPage: query.isFetchingNextPage,
      fetchNextPage: query.fetchNextPage,
   };
};

export default useAuditLog;
export { PAGE_SIZE };
