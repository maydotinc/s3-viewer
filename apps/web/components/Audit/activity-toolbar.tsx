import FilterInput from "@/components/filter-input";
import RefreshButton from "@/components/refresh-button";
import useAsyncAction from "@/lib/hooks/useAsyncAction";
import { api, qs, serverPath } from "@/lib/api";
import useBuckets from "@/lib/hooks/queries/s3/useBuckets";
import {
   auditParams,
   type AuditLogFilters,
} from "@/lib/hooks/queries/server/useAuditLog";
import { useAllMembers } from "@/lib/hooks/queries/server/useMembers";
import type { TimePreset } from "@/lib/utils/audit-time";
import { saveBlob } from "@/lib/utils/download";
import { toastFailure } from "@/lib/utils/toast";
import { Permission, hasPermission } from "@s3-viewer/permissions";
import {
   AUDIT_SEARCH_MAX_CHARS,
   AUDIT_SEARCH_MIN_CHARS,
   type Role,
} from "@s3-viewer/shared";
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
import { Download } from "lucide-react";
import { useId } from "react";
import { ACTION_FAMILY_LABELS, type Option } from "./labels";
import { TIME_PRESET_LABELS } from "./time";
import VerifyButton from "./verify";

const ALL = "all";

const HALF_ON_MOBILE = "w-[calc(50%-0.25rem)]";

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
   canVerify: boolean;
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
   canVerify,
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
   const shortSearch =
      typed.length > 0 && typed.length < AUDIT_SEARCH_MIN_CHARS;

   return (
      <div className="flex min-h-9 shrink-0 flex-wrap items-start gap-2">
         <div className="flex w-full min-w-0 flex-col gap-1 sm:w-72">
            <FilterInput
               label="Search targets"
               placeholder="Search keys, folders and names…"
               maxLength={AUDIT_SEARCH_MAX_CHARS}
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
               {shortSearch
                  ? `Type at least ${AUDIT_SEARCH_MIN_CHARS} characters`
                  : ""}
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
            {canVerify && (
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
         <div className="flex max-w-full min-w-40 flex-1 flex-col items-start gap-1 sm:w-56 sm:flex-none">
            <Skeleton className={`w-full ${CONTROL_SKELETON}`} />
            <div className="h-4" />
         </div>
         <Skeleton className={`w-34 ${CONTROL_SKELETON}`} />
      </div>
   </div>
);

export { ToolbarSkeleton };
export default Toolbar;
