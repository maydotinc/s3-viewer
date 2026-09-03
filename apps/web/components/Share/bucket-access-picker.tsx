import FormError from "@/components/Modals/form-error";
import { BucketAccessEntry, Role, S3Bucket } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { Checkbox } from "@s3-viewer/ui/components/checkbox";
import { Spinner } from "@s3-viewer/ui/components/spinner";
import { useId } from "react";
import RoleSelect from "./role-select";
import { grantableBucketRoles, lowestRole } from "./roles";

type BucketAccessPickerProps = {
   myRole: Role;
   buckets: S3Bucket[];
   isLoading: boolean;
   value: BucketAccessEntry[];
   onChange: (next: BucketAccessEntry[]) => void;
   /** Pass (even as null) to reserve a validation line under the list. */
   error?: string | null;
   disabled?: boolean;
   /** Accessible name for the group of checkboxes. */
   label: string;
   /** Visible section heading. Omit for the inline member panel. */
   heading?: string;
};

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
   const grantable = buckets.filter(
      (b) => grantableBucketRoles(myRole, b).length > 0
   );
   const allSelected =
      grantable.length > 0 && value.length === grantable.length;

   const entryFor = (name: string) => value.find((e) => e.bucketName === name);

   const toggle = (bucket: S3Bucket) => {
      if (entryFor(bucket.name)) {
         onChange(value.filter((e) => e.bucketName !== bucket.name));
         return;
      }
      const role = lowestRole(grantableBucketRoles(myRole, bucket));
      if (role) onChange([...value, { bucketName: bucket.name, role }]);
   };

   const setRole = (name: string, role: Role) =>
      onChange(value.map((e) => (e.bucketName === name ? { ...e, role } : e)));

   const toggleAll = () =>
      onChange(
         allSelected
            ? []
            : grantable.flatMap((b) => {
                 const role =
                    entryFor(b.name)?.role ??
                    lowestRole(grantableBucketRoles(myRole, b));
                 return role ? [{ bucketName: b.name, role }] : [];
              })
      );

   // Always rendered so the header row never changes height or reflows when
   // the buckets resolve — it is only made invisible when there is nothing to
   // toggle.
   const canToggleAll = !isLoading && grantable.length > 0;

   const list = isLoading ? (
      <div className="flex h-24 items-center justify-center">
         <Spinner label="Loading buckets" />
      </div>
   ) : buckets.length === 0 ? (
      <p className="flex h-24 items-center justify-center px-3 text-center text-sm text-viewerlighttext">
         No buckets on this server
      </p>
   ) : (
      <ul className="max-h-64 divide-y divide-viewerborder overflow-y-auto">
         {buckets.map((bucket) => {
            const roles = grantableBucketRoles(myRole, bucket);
            const entry = entryFor(bucket.name);
            const role = entry?.role ?? lowestRole(roles);
            const id = `${labelId}-${bucket.name}`;
            return (
               <li
                  key={bucket.name}
                  className="flex h-10 min-w-0 items-center gap-3 px-3"
               >
                  <Checkbox
                     id={id}
                     checked={Boolean(entry)}
                     disabled={disabled || roles.length === 0}
                     onCheckedChange={() => toggle(bucket)}
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
         <div className="flex min-h-5 min-w-0 items-center justify-between gap-2">
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
               className={`h-auto shrink-0 px-0 ${canToggleAll ? "" : "invisible"}`}
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
            className="min-w-0 rounded-lg border border-viewerborder"
         >
            {list}
         </div>
         {error !== undefined && <FormError>{error}</FormError>}
      </div>
   );
};

export default BucketAccessPicker;
