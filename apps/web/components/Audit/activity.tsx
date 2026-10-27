import { TABLE_PANEL, TableError } from "@/components/Layout/table-states";
import ListPagination from "@/components/list-pagination";
import { SEARCH_DEBOUNCE_MS } from "@/lib/constants";
import useAuditLog, {
   nonemptyFilters,
   type AuditLogFilters,
} from "@/lib/hooks/queries/server/useAuditLog";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import {
   AUDIT_SEARCH_MIN_CHARS,
   type AuditAccess,
   type Role,
} from "@s3-viewer/shared";
import { cn } from "@s3-viewer/ui/lib/utils";
import { useState } from "react";
import {
   ActivityRows,
   ActivitySkeleton,
   ActivityTable,
} from "./activity-table";
import Toolbar from "./activity-toolbar";

const searchTerm = (text: string): string => {
   const trimmed = text.trim();
   return trimmed.length >= AUDIT_SEARCH_MIN_CHARS ? trimmed : "";
};

type ActivityProps = {
   serverId: string;
   myRole: Role;
   audit: AuditAccess;
   bucketsLoading: boolean;
};

const Activity = ({
   serverId,
   myRole,
   audit,
   bucketsLoading,
}: ActivityProps) => {
   const [filters, setFilters] = useState<AuditLogFilters>({});
   const q = useDebouncedValue(searchTerm(filters.q ?? ""), SEARCH_DEBOUNCE_MS);
   const applied: AuditLogFilters = { ...filters, q };
   const log = useAuditLog(serverId, applied);
   const filtered = Object.keys(nonemptyFilters(applied)).length > 0;
   const refreshing = log.isPlaceholderData;

   return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
         <Toolbar
            serverId={serverId}
            myRole={myRole}
            canVerify={audit.canVerify}
            filters={filters}
            applied={applied}
            onChange={setFilters}
            bucketsLoading={bucketsLoading}
            hasActivity={audit.enabled || log.entries.length > 0}
            fetching={log.isFetching && !log.isFetchingNextPage}
            onRefresh={() => void log.refresh()}
         />
         <div
            className={TABLE_PANEL}
            aria-busy={log.isLoading || refreshing || undefined}
         >
            {log.isLoading ? (
               <ActivitySkeleton />
            ) : log.error && log.entries.length === 0 ? (
               <TableError
                  title="Couldn't load activity"
                  retrying={log.isFetching}
                  onRetry={() => void log.refresh()}
               >
                  {log.error.message}
               </TableError>
            ) : (
               <div
                  className={cn(
                     "transition-opacity",
                     refreshing && "pointer-events-none opacity-60"
                  )}
               >
                  <ActivityTable>
                     <ActivityRows
                        entries={log.entries}
                        audit={audit}
                        filtered={filtered}
                     />
                  </ActivityTable>
                  <ListPagination
                     variant="footer"
                     disabled={refreshing}
                     {...log}
                  />
               </div>
            )}
         </div>
      </div>
   );
};

export default Activity;
