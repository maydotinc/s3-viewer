import FormError from "@/components/Modals/form-error";
import { ROLE_LABELS } from "@s3-viewer/permissions";
import { BucketAccessEntry, Role, S3Bucket } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { Checkbox } from "@s3-viewer/ui/components/checkbox";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@s3-viewer/ui/components/select";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { useId } from "react";
import { grantableBucketRoles, lowestRole } from "./roles";

type BucketAccessPickerProps = {
   myRole: Role;
   buckets: S3Bucket[];
   isLoading: boolean;
   value: BucketAccessEntry[];
   onChange: (next: BucketAccessEntry[]) => void;
   error?: string | null;
   disabled?: boolean;
   legend?: string;
};

const BucketAccessPicker = ({
   myRole,
   buckets,
   isLoading,
   value,
   onChange,
   error,
   disabled,
   legend = "Bucket access",
}: BucketAccessPickerProps) => {
   const labelId = useId();
   const grantable = buckets.filter(
      (b) => grantableBucketRoles(myRole, b).length > 0
   );
   const allSelected =
      grantable.length > 0 && value.length === grantable.length;

   const entryFor = (name: string) => value.find((e) => e.bucketName === name);

   const toggle = (bucket: S3Bucket) => {
      const existing = entryFor(bucket.name);
      if (existing) {
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

   return (
      <fieldset className="flex min-w-0 flex-col gap-2">
         <legend className="sr-only">{legend}</legend>
         <div className="flex items-center justify-between">
            <span
               aria-hidden="true"
               className="text-sm font-medium text-viewerblack"
            >
               Bucket access
            </span>
            {grantable.length > 0 && (
               <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto px-0"
                  onClick={toggleAll}
                  disabled={disabled}
               >
                  {allSelected ? "Clear" : "Select all"}
               </Button>
            )}
         </div>
         <div className="max-h-48 overflow-y-auto rounded-lg border border-viewerborder">
            {isLoading ? (
               <ul className="flex flex-col divide-y divide-viewerborder">
                  {[0, 1, 2].map((i) => (
                     <li key={i} className="flex h-10 items-center gap-2 px-3">
                        <Skeleton className="size-4 rounded" />
                        <Skeleton className="h-4 w-32" />
                     </li>
                  ))}
               </ul>
            ) : buckets.length === 0 ? (
               <p className="px-3 py-3 text-sm text-viewerlighttext">
                  No buckets
               </p>
            ) : (
               <ul className="flex flex-col divide-y divide-viewerborder">
                  {buckets.map((bucket) => {
                     const roles = grantableBucketRoles(myRole, bucket);
                     const entry = entryFor(bucket.name);
                     const id = `${labelId}-${bucket.name}`;
                     return (
                        <li
                           key={bucket.name}
                           className="flex h-10 items-center justify-between gap-2 px-3"
                        >
                           <div className="flex min-w-0 items-center gap-2">
                              <Checkbox
                                 id={id}
                                 checked={Boolean(entry)}
                                 disabled={disabled || roles.length === 0}
                                 onCheckedChange={() => toggle(bucket)}
                              />
                              <label
                                 htmlFor={id}
                                 className="truncate text-sm text-viewerblack"
                              >
                                 {bucket.name}
                              </label>
                           </div>
                           {roles.length === 0 ? (
                              <span className="shrink-0 text-xs text-viewerlighttext">
                                 Can&apos;t grant
                              </span>
                           ) : (
                              entry && (
                                 <Select
                                    value={entry.role}
                                    disabled={disabled}
                                    onValueChange={(v) =>
                                       setRole(bucket.name, v as Role)
                                    }
                                 >
                                    <SelectTrigger
                                       size="sm"
                                       className="h-7 w-24 text-xs"
                                       aria-label={`Role on ${bucket.name}`}
                                    >
                                       <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent align="end">
                                       {roles.map((r) => (
                                          <SelectItem
                                             key={r}
                                             value={r}
                                             className="text-xs"
                                          >
                                             {ROLE_LABELS[r]}
                                          </SelectItem>
                                       ))}
                                    </SelectContent>
                                 </Select>
                              )
                           )}
                        </li>
                     );
                  })}
               </ul>
            )}
         </div>
         {error !== undefined && <FormError>{error}</FormError>}
      </fieldset>
   );
};

export default BucketAccessPicker;
