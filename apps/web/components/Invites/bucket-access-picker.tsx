import { CellBar, nameBarWidth } from "@/components/DataGrid/skeleton";
import InlineAlert from "@/components/inline-alert";
import StatusMessage, { RetryButton } from "@/components/status-message";
import type { BucketAccessEntry, Role, S3Bucket } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { Checkbox } from "@s3-viewer/ui/components/checkbox";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { cn } from "@s3-viewer/ui/lib/utils";
import { Database } from "lucide-react";
import {
   memo,
   useCallback,
   useId,
   useMemo,
   type Dispatch,
   type ReactNode,
   type SetStateAction,
} from "react";
import {
   accessErrors,
   heldFolders,
   checkedGrant,
   newGrant,
   withRole,
   type GrantRow,
} from "./bucket-grants";
import GrantScope from "./grant-scope";
import RoleSelect from "./role-select";
import { grantableBucketRoles, lowestRole } from "./roles";

type BucketAccessPickerProps = {
   serverId: string;
   serverName?: string;
   myRole: Role;
   buckets: S3Bucket[];
   isLoading: boolean;
   loadError?: Error | null;
   onRetry?: () => void;
   retrying?: boolean;
   value: GrantRow[];
   onChange: Dispatch<SetStateAction<GrantRow[]>>;
   original?: BucketAccessEntry[];
   serverRole?: Role;
   showErrors?: boolean;
   error?: string | null;
   errorAction?: ReactNode;
   disabled?: boolean;
   label: string;
   heading?: string;
   children?: ReactNode;
};

type BucketRow = { bucket: S3Bucket; roles: Role[] };

type BucketAccessRowProps = BucketRow & {
   id: string;
   serverId: string;
   myRole: Role;
   entry: GrantRow | undefined;
   original: BucketAccessEntry | undefined;
   serverRole?: Role;
   error: string | null;
   showErrors: boolean;
   disabled?: boolean;
   onToggle: (bucket: S3Bucket, roles: Role[]) => void;
   onUpdate: (next: GrantRow) => void;
};

const ROLE_SELECT = "w-28 shrink-0 sm:w-32";

// three rows stay inside the list's min height, so loading and loaded lists share a height
const SKELETON_ROWS = 3;

const BucketAccessRow = memo(function BucketAccessRow({
   id,
   serverId,
   myRole,
   bucket,
   roles,
   entry,
   original,
   serverRole,
   error,
   showErrors,
   disabled,
   onToggle,
   onUpdate,
}: BucketAccessRowProps) {
   const role = entry?.role ?? lowestRole(roles);
   const empty = entry?.folders?.length === 0;
   return (
      <li className="flex min-w-0 flex-col px-3">
         <div className="flex h-10 min-w-0 items-center gap-3">
            <Checkbox
               id={id}
               checked={Boolean(entry)}
               disabled={disabled || roles.length === 0}
               onCheckedChange={() => onToggle(bucket, roles)}
            />
            <label
               htmlFor={id}
               className="min-w-0 flex-1 cursor-pointer truncate text-sm text-viewerblack"
            >
               {bucket.name}
            </label>
            {role === null ? (
               <span className="shrink-0 text-xs text-viewerlighttext">
                  Can&apos;t grant
               </span>
            ) : (
               <RoleSelect
                  size="sm"
                  className={ROLE_SELECT}
                  label={`Role on ${bucket.name}`}
                  value={role}
                  roles={roles}
                  disabled={disabled || !entry}
                  onChange={(next) => entry && onUpdate(withRole(entry, next))}
               />
            )}
         </div>
         {entry && (
            <GrantScope
               serverId={serverId}
               entry={entry}
               held={heldFolders(myRole, bucket)}
               original={original}
               serverRole={serverRole}
               error={error}
               showError={showErrors || !empty}
               disabled={disabled || roles.length === 0}
               onChange={onUpdate}
            />
         )}
      </li>
   );
});

const BucketSkeletonRows = () => (
   <ul aria-hidden="true" className="divide-y divide-viewerborder">
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
         <li key={index} className="px-3">
            <div className="flex h-10 items-center gap-3">
               <Skeleton className="size-4 shrink-0 rounded" />
               <CellBar className={nameBarWidth(index)} />
               <Skeleton
                  className={cn("ml-auto h-8 shrink-0 rounded-lg", ROLE_SELECT)}
               />
            </div>
         </li>
      ))}
   </ul>
);

const LinkButton = ({
   hidden,
   disabled,
   onClick,
   children,
}: {
   hidden: boolean;
   disabled?: boolean;
   onClick: () => void;
   children: ReactNode;
}) => (
   <Button
      type="button"
      variant="link"
      size="sm"
      className={cn("h-auto shrink-0 px-0", hidden && "invisible")}
      onClick={onClick}
      disabled={disabled || hidden}
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
   >
      {children}
   </Button>
);

const BucketAccessPicker = ({
   serverId,
   serverName,
   myRole,
   buckets,
   isLoading,
   loadError = null,
   onRetry,
   retrying = false,
   value,
   onChange,
   original,
   serverRole,
   showErrors = false,
   error,
   errorAction,
   disabled,
   label,
   heading,
   children,
}: BucketAccessPickerProps) => {
   const labelId = useId();
   const errorId = `${labelId}-error`;

   const rows = useMemo<BucketRow[]>(
      () =>
         buckets.map((bucket) => ({
            bucket,
            roles: grantableBucketRoles(myRole, bucket),
         })),
      [buckets, myRole]
   );
   const grantable = useMemo(
      () => rows.filter((row) => row.roles.length > 0),
      [rows]
   );
   const grantableNames = useMemo(
      () => new Set(grantable.map((row) => row.bucket.name)),
      [grantable]
   );
   const selected = useMemo(
      () => new Map(value.map((entry) => [entry.bucketName, entry])),
      [value]
   );
   const originals = useMemo(
      () => new Map(original?.map((entry) => [entry.bucketName, entry])),
      [original]
   );
   const errors = useMemo(
      () =>
         accessErrors(value, {
            buckets,
            myRole,
            originals: original,
            serverRole,
            drafts: showErrors,
         }),
      [value, buckets, myRole, original, serverRole, showErrors]
   );
   const allSelected =
      grantable.length > 0 &&
      grantable.every((row) => selected.has(row.bucket.name));

   const toggle = useCallback(
      (bucket: S3Bucket, roles: Role[]) =>
         onChange((current) => {
            if (current.some((e) => e.bucketName === bucket.name))
               return current.filter((e) => e.bucketName !== bucket.name);
            const before = originals.get(bucket.name);
            const role = before?.role ?? lowestRole(roles);
            return role
               ? [
                    ...current,
                    checkedGrant(before, myRole, bucket, role, serverRole),
                 ]
               : current;
         }),
      [onChange, originals, myRole, serverRole]
   );

   const update = useCallback(
      (next: GrantRow) =>
         onChange((current) =>
            current.map((e) => (e.bucketName === next.bucketName ? next : e))
         ),
      [onChange]
   );

   const toggleAll = () => {
      const kept = value.filter(
         (entry) => !grantableNames.has(entry.bucketName)
      );
      onChange(
         allSelected
            ? kept
            : [
                 ...kept,
                 ...grantable.flatMap(({ bucket, roles }) => {
                    const current = selected.get(bucket.name);
                    if (current) return [current];
                    const role = lowestRole(roles);
                    return role
                       ? [newGrant(myRole, bucket, role, serverRole)]
                       : [];
                 }),
              ]
      );
   };

   const canToggleAll =
      !isLoading && loadError === null && grantable.length > 0;

   const list = isLoading ? (
      <BucketSkeletonRows />
   ) : loadError ? (
      <div className="flex min-h-40 items-center p-3">
         <InlineAlert
            className="flex-1"
            action={
               onRetry && (
                  <RetryButton
                     size="sm"
                     onRetry={onRetry}
                     retrying={retrying}
                  />
               )
            }
         >
            Couldn&apos;t load buckets{serverName ? ` on ${serverName}` : ""}.
         </InlineAlert>
      </div>
   ) : buckets.length === 0 ? (
      <StatusMessage icon={Database} className="min-h-40 py-4">
         No buckets on this server
      </StatusMessage>
   ) : (
      <ul className="divide-y divide-viewerborder">
         {rows.map(({ bucket, roles }) => (
            <BucketAccessRow
               key={bucket.name}
               id={`${labelId}-${bucket.name}`}
               serverId={serverId}
               myRole={myRole}
               bucket={bucket}
               roles={roles}
               entry={selected.get(bucket.name)}
               original={originals.get(bucket.name)}
               serverRole={serverRole}
               error={errors.get(bucket.name) ?? null}
               showErrors={showErrors}
               disabled={disabled}
               onToggle={toggle}
               onUpdate={update}
            />
         ))}
      </ul>
   );

   return (
      <div className="flex min-w-0 flex-col gap-2">
         <div className="flex min-h-5 min-w-0 flex-wrap items-center justify-between gap-x-2">
            {heading ? (
               <h3 className="shrink-0 text-sm font-medium text-viewerblack">
                  {heading}
               </h3>
            ) : (
               <span aria-hidden="true" />
            )}
            <LinkButton
               hidden={!canToggleAll}
               disabled={disabled}
               onClick={toggleAll}
            >
               {allSelected ? "Clear" : "Select all"}
            </LinkButton>
         </div>
         {children}
         <div
            role="group"
            aria-label={label}
            aria-busy={isLoading || undefined}
            aria-describedby={errorId}
            className="relative flex max-h-80 min-h-40 min-w-0 flex-col overflow-y-auto rounded-lg border border-viewerborder [scrollbar-gutter:stable]"
         >
            {list}
         </div>
         <div className="flex min-h-5 min-w-0 items-start justify-between gap-3">
            <p
               id={errorId}
               role={error ? "alert" : undefined}
               className="min-w-0 break-words text-xs leading-5 text-viewertextred"
            >
               {error}
            </p>
            {errorAction}
         </div>
      </div>
   );
};

export default BucketAccessPicker;
