import CenteredSpinner from "@/components/centered-spinner";
import FormError from "@/components/Modals/form-error";
import type { BucketAccessEntry, Role, S3Bucket } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { Checkbox } from "@s3-viewer/ui/components/checkbox";
import { cn } from "@s3-viewer/ui/lib/utils";
import {
   memo,
   useCallback,
   useId,
   useMemo,
   type Dispatch,
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
   myRole: Role;
   buckets: S3Bucket[];
   isLoading: boolean;
   value: GrantRow[];
   onChange: Dispatch<SetStateAction<GrantRow[]>>;
   original?: BucketAccessEntry[];
   serverRole?: Role;
   showErrors?: boolean;
   error?: string | null;
   reserveErrorSpace?: boolean;
   disabled?: boolean;
   label: string;
   heading?: string;
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
      <li className="flex min-w-0 flex-col">
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
                  className="w-32 shrink-0"
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

const BucketAccessPicker = ({
   serverId,
   myRole,
   buckets,
   isLoading,
   value,
   onChange,
   original,
   serverRole,
   showErrors = false,
   error,
   reserveErrorSpace = false,
   disabled,
   label,
   heading,
}: BucketAccessPickerProps) => {
   const labelId = useId();

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

   const canToggleAll = !isLoading && grantable.length > 0;

   const list = isLoading ? (
      <CenteredSpinner label="Loading buckets" className="h-full" />
   ) : buckets.length === 0 ? (
      <p className="flex h-full items-center justify-center text-center text-sm text-viewerlighttext">
         No buckets on this server
      </p>
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
         <div className="flex h-5 min-w-0 items-center justify-between gap-2">
            {heading ? (
               <h3 className="min-w-0 truncate text-sm font-medium text-viewerblack">
                  {heading}
               </h3>
            ) : (
               <span aria-hidden="true" />
            )}
            <Button
               type="button"
               variant="link"
               size="sm"
               className={cn(
                  "h-auto shrink-0 px-0",
                  !canToggleAll && "invisible"
               )}
               onClick={toggleAll}
               disabled={disabled || !canToggleAll}
               aria-hidden={!canToggleAll}
               tabIndex={canToggleAll ? undefined : -1}
            >
               {allSelected ? "Clear" : "Select all"}
            </Button>
         </div>
         <div
            role="group"
            aria-label={label}
            className="relative grid max-h-64 min-h-10 min-w-0 overflow-y-auto [scrollbar-gutter:stable]"
         >
            {list}
         </div>
         {(reserveErrorSpace || Boolean(error)) && (
            <FormError>{error}</FormError>
         )}
      </div>
   );
};

export default BucketAccessPicker;
