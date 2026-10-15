import FilterInput from "@/components/filter-input";
import {
   EmptyRow,
   TABLE_PANEL,
   TableError,
} from "@/components/Layout/table-states";
import ListPagination from "@/components/list-pagination";
import RefreshButton from "@/components/refresh-button";
import RelativeTime from "@/components/relative-time";
import TableSkeletonRows from "@/components/table-skeleton";
import useAsyncAction from "@/components/use-async-action";
import { api, qs, serverPath } from "@/lib/api";
import { SEARCH_DEBOUNCE_MS } from "@/lib/constants";
import useBuckets from "@/lib/hooks/queries/s3/useBuckets";
import useAuditLog, {
   nonemptyFilters,
   auditParams,
   type AuditLogFilters,
} from "@/lib/hooks/queries/server/useAuditLog";
import { useAllMembers } from "@/lib/hooks/queries/server/useMembers";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { saveBlob } from "@/lib/utils/download";
import { visibleText } from "@/lib/utils/format";
import { toastFailure } from "@/lib/utils/toast";
import { Permission, hasPermission } from "@s3-viewer/permissions";
import type { AuditAccess, AuditLogEntry, Role } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { Input } from "@s3-viewer/ui/components/input";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@s3-viewer/ui/components/select";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "@s3-viewer/ui/components/table";
import { cn } from "@s3-viewer/ui/lib/utils";
import { Download, History } from "lucide-react";
import { memo, useId, useState, type ReactNode } from "react";
import {
   ACTION_FAMILY_LABELS,
   ACTION_LABELS,
   metaOf,
   targetOf,
   type Option,
} from "./labels";
import { TIME_PRESET_LABELS, type TimePreset } from "./time";
import VerifyButton, { canVerifyAudit } from "./verify";

const COLUMNS = 4;

const SKELETON_COLUMNS = [{}, {}, {}, { align: "right" }] as const;

const ALL = "all";

const HALF_ON_MOBILE = "w-[calc(50%-0.25rem)]";

const MIN_SEARCH = 3;
const MAX_SEARCH = 256;

const ACTION_OPTIONS: readonly Option[] = [
   { value: "", label: "All actions" },
   ...Object.entries(ACTION_FAMILY_LABELS).map(([value, label]) => ({
      value,
      label,
   })),
];

const TIME_OPTIONS: readonly Option[] = Object.entries(TIME_PRESET_LABELS).map(
   ([value, label]) => ({ value, label })
);

const emptyMessage = (audit: AuditAccess, filtered: boolean): string =>
   filtered
      ? "No activity matches these filters."
      : audit.enabled
        ? "Nothing has been recorded yet."
        : audit.canManage
          ? "The audit log is off. Turn it on under Settings."
          : "The audit log is off for this server.";

const searchTerm = (text: string): string => {
   const trimmed = text.trim();
   return trimmed.length >= MIN_SEARCH ? trimmed : "";
};

const shown = (text: string | null): string | null =>
   text ? visibleText(text) : null;

const ActivityRow = ({ entry }: { entry: AuditLogEntry }) => {
   const target = shown(targetOf(entry));
   const meta = shown(metaOf(entry));
   const details = [target, meta].filter(Boolean).join(" ");
   return (
      <TableRow>
         <TableCell title={entry.actorEmail} className="min-w-0 truncate px-6">
            {entry.actorEmail}
         </TableCell>
         <TableCell
            title={ACTION_LABELS[entry.action]}
            className="min-w-0 truncate"
         >
            {ACTION_LABELS[entry.action]}
         </TableCell>
         <TableCell title={details || undefined} className="min-w-0 truncate">
            <span className="text-viewerblack">{target ?? meta ?? "—"}</span>
            {target && meta && (
               <span className="ml-2 text-xs text-viewerlighttext">{meta}</span>
            )}
         </TableCell>
         <TableCell className="text-right tabular-nums">
            <RelativeTime date={entry.createdAt} className="text-viewertext" />
         </TableCell>
      </TableRow>
   );
};

type ActivityRowsProps = {
   entries: readonly AuditLogEntry[];
   audit: AuditAccess;
   filtered: boolean;
};

const ActivityRows = memo(function ActivityRows({
   entries,
   audit,
   filtered,
}: ActivityRowsProps) {
   return (
      <TableBody>
         {entries.length === 0 ? (
            <EmptyRow colSpan={COLUMNS} icon={History}>
               {emptyMessage(audit, filtered)}
            </EmptyRow>
         ) : (
            entries.map((entry) => <ActivityRow key={entry.id} entry={entry} />)
         )}
      </TableBody>
   );
});

const ActivityTable = ({ children }: { children: ReactNode }) => (
   <Table className="min-w-[720px] table-fixed">
      <TableHeader>
         <TableRow>
            <TableHead className="w-44 px-6 @4xl:w-56">Person</TableHead>
            <TableHead className="w-36 @4xl:w-48">Action</TableHead>
            <TableHead>Details</TableHead>
            <TableHead className="w-36 text-right tabular-nums">When</TableHead>
         </TableRow>
      </TableHeader>
      {children}
   </Table>
);

const ActivitySkeleton = () => (
   <ActivityTable>
      <TableBody>
         <TableSkeletonRows
            columns={SKELETON_COLUMNS}
            rowClassName="[&>td:first-child]:px-6"
         />
      </TableBody>
   </ActivityTable>
);

type FilterSelectProps = {
   label: string;
   value: string;
   options: readonly Option[];
   width: string;
   menuWidth?: string;
   disabled?: boolean;
   onChange: (value: string) => void;
};

const FilterSelect = ({
   label,
   value,
   options,
   width,
   menuWidth,
   disabled,
   onChange,
}: FilterSelectProps) => (
   <Select
      value={value || ALL}
      disabled={disabled}
      onValueChange={(next) => onChange(next === ALL ? "" : next)}
   >
      <SelectTrigger aria-label={label} className={`max-w-full ${width}`}>
         <SelectValue />
      </SelectTrigger>
      <SelectContent className={menuWidth}>
         {options.map((option) => (
            <SelectItem
               key={option.value}
               value={option.value || ALL}
               description={option.description}
            >
               {option.label}
            </SelectItem>
         ))}
      </SelectContent>
   </Select>
);

type PersonFilterProps = {
   serverId: string;
   value: string;
   onChange: (actor: string) => void;
};

const PersonFilter = ({ serverId, value, onChange }: PersonFilterProps) => {
   const { members, isLoading } = useAllMembers(serverId);
   return (
      <FilterSelect
         label="Person"
         value={value}
         width={`${HALF_ON_MOBILE} sm:w-48`}
         menuWidth="w-72"
         disabled={isLoading}
         options={[
            { value: "", label: "All people" },
            ...members.map((member) => ({
               value: member.id,
               label: member.name,
               description: member.email,
            })),
         ]}
         onChange={onChange}
      />
   );
};

type ExportProps = {
   serverId: string;
   filters: AuditLogFilters;
   disabled: boolean;
};

const ExportButton = ({ serverId, filters, disabled }: ExportProps) => {
   const { pending, run } = useAsyncAction(toastFailure);
   return (
      <Button
         type="button"
         variant="outline"
         loading={pending}
         disabled={disabled}
         onClick={() =>
            void run(async () => {
               const blob = await api.blob(
                  `${serverPath(serverId)}/audit/export${qs(auditParams(filters))}`
               );
               saveBlob(
                  `audit-${serverId}-${new Date().toISOString().slice(0, 10)}.csv`,
                  blob
               );
            })
         }
      >
         <Download aria-hidden="true" />
         Export CSV
      </Button>
   );
};

type ToolbarProps = {
   serverId: string;
   myRole: Role;
   filters: AuditLogFilters;
   applied: AuditLogFilters;
   onChange: (filters: AuditLogFilters) => void;
   bucketsLoading: boolean;
   hasActivity: boolean;
   fetching: boolean;
   onRefresh: () => void;
};

const Toolbar = ({
   serverId,
   myRole,
   filters,
   applied,
   onChange,
   bucketsLoading,
   hasActivity,
   fetching,
   onRefresh,
}: ToolbarProps) => {
   const { buckets } = useBuckets();
   const id = useId();
   const typed = filters.q?.trim() ?? "";
   const shortSearch = typed.length > 0 && typed.length < MIN_SEARCH;

   return (
      <div className="flex min-h-9 shrink-0 flex-wrap items-start gap-2">
         <div className="flex w-full min-w-0 flex-col gap-1 sm:w-72">
            <FilterInput
               label="Search targets"
               placeholder="Search keys, folders and names…"
               maxLength={MAX_SEARCH}
               aria-describedby={`${id}-search-hint`}
               value={filters.q ?? ""}
               onChange={(event) =>
                  onChange({ ...filters, q: event.target.value })
               }
            />
            <p
               id={`${id}-search-hint`}
               aria-live="polite"
               className="h-4 text-xs leading-4 text-viewerlighttext"
            >
               {shortSearch ? `Type at least ${MIN_SEARCH} characters` : ""}
            </p>
         </div>
         <FilterSelect
            label="Action"
            value={filters.action ?? ""}
            width={`${HALF_ON_MOBILE} sm:w-40`}
            options={ACTION_OPTIONS}
            onChange={(action) => onChange({ ...filters, action })}
         />
         {hasPermission(myRole, Permission.MANAGE_MEMBERS) && (
            <PersonFilter
               serverId={serverId}
               value={filters.actor ?? ""}
               onChange={(actor) => onChange({ ...filters, actor })}
            />
         )}
         <FilterSelect
            label="Bucket"
            value={filters.bucket ?? ""}
            width={`${HALF_ON_MOBILE} sm:w-48`}
            disabled={bucketsLoading}
            options={[
               { value: "", label: "All buckets" },
               ...buckets.map(({ name }) => ({ value: name, label: name })),
            ]}
            onChange={(bucket) => onChange({ ...filters, bucket })}
         />
         <FilterSelect
            label="Time"
            value={filters.preset ?? ""}
            width={`${HALF_ON_MOBILE} sm:w-40`}
            options={TIME_OPTIONS}
            onChange={(preset) =>
               onChange({
                  ...filters,
                  preset: preset as TimePreset,
                  from: "",
                  to: "",
               })
            }
         />
         {filters.preset === "custom" && (
            <>
               <label htmlFor={`${id}-from`} className="sr-only">
                  From
               </label>
               <Input
                  id={`${id}-from`}
                  type="date"
                  className={`${HALF_ON_MOBILE} sm:w-40`}
                  value={filters.from ?? ""}
                  max={filters.to || undefined}
                  onChange={(event) =>
                     onChange({ ...filters, from: event.target.value })
                  }
               />
               <label htmlFor={`${id}-to`} className="sr-only">
                  To
               </label>
               <Input
                  id={`${id}-to`}
                  type="date"
                  className={`${HALF_ON_MOBILE} sm:w-40`}
                  value={filters.to ?? ""}
                  min={filters.from || undefined}
                  onChange={(event) =>
                     onChange({ ...filters, to: event.target.value })
                  }
               />
            </>
         )}
         <div className="flex w-full min-w-0 flex-wrap items-start gap-2 sm:ml-auto sm:w-auto">
            <RefreshButton spinning={fetching} onClick={onRefresh} />
            {canVerifyAudit(myRole) && (
               <VerifyButton serverId={serverId} disabled={!hasActivity} />
            )}
            <ExportButton
               serverId={serverId}
               filters={applied}
               disabled={!hasActivity}
            />
         </div>
      </div>
   );
};

const CONTROL_SKELETON = "h-9 rounded-lg pointer-coarse:h-11";

// the role isn't known yet, so this mirrors the admin toolbar (person filter and verify included)
const ToolbarSkeleton = () => (
   <div className="flex min-h-9 shrink-0 flex-wrap items-start gap-2">
      <div className="flex w-full min-w-0 flex-col gap-1 sm:w-72">
         <Skeleton className={`w-full ${CONTROL_SKELETON}`} />
         <div className="h-4" />
      </div>
      <Skeleton className={`${HALF_ON_MOBILE} sm:w-40 ${CONTROL_SKELETON}`} />
      <Skeleton className={`${HALF_ON_MOBILE} sm:w-48 ${CONTROL_SKELETON}`} />
      <Skeleton className={`${HALF_ON_MOBILE} sm:w-48 ${CONTROL_SKELETON}`} />
      <Skeleton className={`${HALF_ON_MOBILE} sm:w-40 ${CONTROL_SKELETON}`} />
      <div className="flex w-full min-w-0 flex-wrap items-start gap-2 sm:ml-auto sm:w-auto">
         <Skeleton className="size-9 rounded-lg pointer-coarse:size-11" />
         <div className="flex max-w-full min-w-40 flex-1 flex-col items-start gap-2 sm:w-56 sm:flex-none">
            <Skeleton className={`w-full ${CONTROL_SKELETON}`} />
            <div className="h-12 w-full" />
         </div>
         <Skeleton className={`w-34 ${CONTROL_SKELETON}`} />
      </div>
   </div>
);

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
export { ActivitySkeleton, ToolbarSkeleton };
