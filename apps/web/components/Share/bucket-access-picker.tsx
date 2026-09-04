import FormError from "@/components/Modals/form-error";
import { BucketAccessEntry, Role, S3Bucket } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { Checkbox } from "@s3-viewer/ui/components/checkbox";
import { Spinner } from "@s3-viewer/ui/components/spinner";
import { cn } from "@s3-viewer/ui/lib/utils";
import { useId, useMemo } from "react";
import RoleSelect from "./role-select";
import { grantableBucketRoles, lowestRole } from "./roles";

type BucketAccessPickerProps = {
   myRole: Role;
   buckets: S3Bucket[];
   isLoading: boolean;
   value: BucketAccessEntry[];
   onChange: (next: BucketAccessEntry[]) => void;
   // pass (even as null) to reserve a validation line under the list.
   error?: string | null;
   disabled?: boolean;
   label: string;
   heading?: string;
};

type BucketRow = { bucket: S3Bucket; roles: Role[] };

const BucketAccessPicker = ({
   myRole,
   buckets,
   isLoading,
   value,
   onChange,
   error,
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
   const allSelected =
      grantable.length > 0 &&
      grantable.every((row) => selected.has(row.bucket.name));

   const toggle = (bucket: S3Bucket, roles: Role[]) => {
      if (selected.has(bucket.name)) {
         onChange(value.filter((e) => e.bucketName !== bucket.name));
         return;
      }
      const role = lowestRole(roles);
      if (role) onChange([...value, { bucketName: bucket.name, role }]);
   };

   const setRole = (name: string, role: Role) =>
      onChange(value.map((e) => (e.bucketName === name ? { ...e, role } : e)));

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
                    const role =
                       selected.get(bucket.name)?.role ?? lowestRole(roles);
                    return role ? [{ bucketName: bucket.name, role }] : [];
                 }),
              ]
      );
   };

   // the toggle is only made invisible, never unmounted, so the heading row
   // does not reflow when the buckets resolve.
   const canToggleAll = !isLoading && grantable.length > 0;

   const list = isLoading ? (
      <div className="flex h-24 items-center justify-center">
         <Spinner label="Loading buckets" />
      </div>
   ) : buckets.length === 0 ? (
      <p className="flex h-24 items-center justify-center text-center text-sm text-viewerlighttext">
         No buckets on this server
      </p>
   ) : (
      <ul className="max-h-64 divide-y divide-viewerborder overflow-y-auto">
         {rows.map(({ bucket, roles }) => {
            const entry = selected.get(bucket.name);
            const role = entry?.role ?? lowestRole(roles);
            const id = `${labelId}-${bucket.name}`;
            return (
               <li
                  key={bucket.name}
                  className="flex h-10 min-w-0 items-center gap-3"
               >
                  <Checkbox
                     id={id}
                     checked={Boolean(entry)}
                     disabled={disabled || roles.length === 0}
                     onCheckedChange={() => toggle(bucket, roles)}
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
                        onChange={(next) => setRole(bucket.name, next)}
                     />
                  )}
               </li>
            );
         })}
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
         <div role="group" aria-label={label} className="min-w-0">
            {list}
         </div>
         {error !== undefined && <FormError>{error}</FormError>}
      </div>
   );
};

export default BucketAccessPicker;
