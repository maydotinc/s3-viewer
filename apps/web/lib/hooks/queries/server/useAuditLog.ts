import { ApiError, api, qs, serverPath } from "@/lib/api";
import useCursorQuery, { pageCursor } from "@/lib/hooks/queries/useCursorQuery";
import { queryKeys, type AuditFilters } from "@/lib/query-keys";
import { useUserId } from "@/lib/stores/session-store";
import { timeRange, type TimePreset } from "@/lib/utils/audit-time";
import { ErrorCode, type AuditLogPage } from "@s3-viewer/types";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

const PAGE_SIZE = 50;

const pageEntries = (page: AuditLogPage) => page.entries;

type AuditLogFilters = AuditFilters & { preset?: TimePreset };

const nonemptyFilters = (filters: AuditLogFilters): AuditLogFilters =>
   Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value)
   ) as AuditLogFilters;

const auditParams = ({
   preset = "",
   from,
   to,
   ...rest
}: AuditLogFilters): AuditFilters => ({
   ...rest,
   ...timeRange(preset, { from, to }),
});

const useAuditLog = (serverId: string, filters: AuditLogFilters) => {
   const userId = useUserId();
   const queryClient = useQueryClient();
   const key = JSON.stringify(nonemptyFilters(filters));
   const active = useMemo(() => JSON.parse(key) as AuditLogFilters, [key]);
   const queryKey = useMemo(
      () => queryKeys.auditLog(userId, serverId, active),
      [userId, serverId, active]
   );

   const {
      items: entries,
      data,
      ...pages
   } = useCursorQuery({
      queryKey,
      queryFn: (cursor, signal) =>
         api.get<AuditLogPage>(
            `${serverPath(serverId)}/audit${qs({
               cursor,
               limit: PAGE_SIZE,
               ...auditParams(active),
            })}`,
            signal
         ),
      select: pageEntries,
      nextCursor: pageCursor,
      enabled: Boolean(userId && serverId),
      refetchOnWindowFocus: false,
      keepPreviousWithin: queryKeys.auditLogs(userId, serverId),
   });

   const { error } = pages;
   const isBadCursor =
      error instanceof ApiError &&
      error.status === 400 &&
      error.code === ErrorCode.VALIDATION &&
      (data?.pages.length ?? 0) > 0;

   useEffect(() => {
      if (isBadCursor) void queryClient.resetQueries({ queryKey, exact: true });
   }, [isBadCursor, queryClient, queryKey]);

   // a plain refetch re-requests every loaded page against the 60/min audit read limit
   const refresh = () => {
      queryClient.setQueryData<InfiniteData<AuditLogPage, string | null>>(
         queryKey,
         (current) =>
            current && {
               pages: current.pages.slice(0, 1),
               pageParams: current.pageParams.slice(0, 1),
            }
      );
      return pages.refetch();
   };

   return { entries, refresh, ...pages };
};

export default useAuditLog;
export { nonemptyFilters, auditParams };
export type { AuditLogFilters };
