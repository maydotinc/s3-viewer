import FormError from "@/components/Modals/form-error";
import { BucketAccessEntry, Role, S3Bucket } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { Checkbox } from "@s3-viewer/ui/components/checkbox";
import { Spinner } from "@s3-viewer/ui/components/spinner";
import { cn } from "@s3-viewer/ui/lib/utils";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useId, useMemo, useRef } from "react";
import RoleSelect from "./role-select";
import { grantableBucketRoles, lowestRole } from "./roles";

const ROW_HEIGHT = 40;

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
   const scrollRef = useRef<HTMLDivElement>(null);

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
   const selected = useMemo(
      () => new Map(value.map((entry) => [entry.bucketName, entry])),
      [value]
   );
   const allSelected =
      grantable.length > 0 && value.length === grantable.length;

   const virtualizer = useVirtualizer({
      count: rows.length,
      getScrollElement: () => scrollRef.current,
      estimateSize: () => ROW_HEIGHT,
      overscan: 8,
   });

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

   const toggleAll = () =>
      onChange(
         allSelected
            ? []
            : grantable.flatMap(({ bucket, roles }) => {
                 const role =
                    selected.get(bucket.name)?.role ?? lowestRole(roles);
                 return role ? [{ bucketName: bucket.name, role }] : [];
              })
      );

   // the toggle is only made invisible, never unmounted, so the header row
   // does not reflow when the buckets resolve.
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
      <div ref={scrollRef} className="max-h-64 overflow-y-auto">
         <ul
            className="relative w-full"
            style={{ height: `${virtualizer.getTotalSize()}px` }}
         >
            {virtualizer.getVirtualItems().map((item) => {
               const row = rows[item.index];
               if (!row) return null;
               const { bucket, roles } = row;
               const entry = selected.get(bucket.name);
               const role = entry?.role ?? lowestRole(roles);
               const id = `${labelId}-${bucket.name}`;
               return (
                  <li
                     key={bucket.name}
                     className={cn(
                        "absolute left-0 top-0 flex w-full min-w-0 items-center gap-3 px-3",
                        item.index > 0 && "border-t border-viewerborder"
                     )}
                     style={{
                        transform: `translateY(${item.start}px)`,
                        height: `${item.size}px`,
                     }}
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
      </div>
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
