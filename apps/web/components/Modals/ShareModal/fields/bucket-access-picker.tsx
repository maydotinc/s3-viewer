import useBuckets from "@/lib/hooks/queries/s3/useBuckets";
import { BucketAccessEntry, Role } from "@s3-viewer/types";
import { Checkbox } from "@s3-viewer/ui/components/checkbox";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@s3-viewer/ui/components/select";
import { Loader2 } from "lucide-react";
import { useShareContext } from "../context/ShareContext";

const BUCKET_ROLES: { value: Role; label: string }[] = [
   { value: Role.VIEWER, label: "Read" },
   { value: Role.EDITOR, label: "Write" },
   { value: Role.ADMIN, label: "Admin" },
];

const BucketAccessPicker = () => {
   const { serverId, bucketAccessList, setBucketAccessList } =
      useShareContext();
   const { buckets, isBucketsLoading } = useBuckets(serverId);

   const isBucketSelected = (bucketName: string) =>
      bucketAccessList.some((ba) => ba.bucketName === bucketName);

   const getBucketRole = (bucketName: string): Role =>
      bucketAccessList.find((ba) => ba.bucketName === bucketName)?.role ??
      Role.VIEWER;

   const toggleBucket = (bucketName: string) => {
      if (isBucketSelected(bucketName)) {
         setBucketAccessList(
            bucketAccessList.filter((ba) => ba.bucketName !== bucketName)
         );
      } else {
         setBucketAccessList([
            ...bucketAccessList,
            { bucketName, role: Role.VIEWER },
         ]);
      }
   };

   const updateBucketRole = (bucketName: string, role: Role) => {
      setBucketAccessList(
         bucketAccessList.map((ba) =>
            ba.bucketName === bucketName ? { ...ba, role } : ba
         )
      );
   };

   const toggleAll = () => {
      if (bucketAccessList.length === buckets.length) {
         setBucketAccessList([]);
      } else {
         const newEntries: BucketAccessEntry[] = buckets.map((b) => ({
            bucketName: b.Name,
            role:
               bucketAccessList.find((ba) => ba.bucketName === b.Name)?.role ??
               Role.VIEWER,
         }));
         setBucketAccessList(newEntries);
      }
   };

   if (isBucketsLoading) {
      return (
         <div className="flex items-center justify-center py-4">
            <Loader2 className="size-4 animate-spin text-gray-400" />
            <span className="ml-2 text-sm text-gray-500">
               Loading buckets...
            </span>
         </div>
      );
   }

   if (buckets.length === 0) {
      return (
         <p className="text-sm text-gray-500 py-2">
            No buckets found on this server.
         </p>
      );
   }

   return (
      <div className="flex flex-col gap-2">
         <div className="flex items-center justify-between">
            <div className="flex flex-col">
               <label className="text-sm font-medium text-black">
                  Bucket Access
               </label>
               <span className="text-[11px] text-gray-400">
                  Controls what they can do with files
               </span>
            </div>
            <button
               type="button"
               onClick={toggleAll}
               className="text-xs text-viewerblue hover:underline"
            >
               {bucketAccessList.length === buckets.length
                  ? "Deselect all"
                  : "Select all"}
            </button>
         </div>
         <div className="max-h-48 overflow-y-auto border border-viewerborder rounded-xl">
            {buckets.map((bucket) => {
               const selected = isBucketSelected(bucket.Name);
               return (
                  <div
                     key={bucket.Name}
                     className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors border-b border-viewerborder last:border-b-0"
                  >
                     <div className="flex items-center gap-2 min-w-0">
                        <Checkbox
                           checked={selected}
                           onCheckedChange={() => toggleBucket(bucket.Name)}
                        />
                        <span className="text-sm text-black truncate">
                           {bucket.Name}
                        </span>
                     </div>
                     {selected && (
                        <Select
                           value={getBucketRole(bucket.Name)}
                           onValueChange={(val) =>
                              updateBucketRole(bucket.Name, val as Role)
                           }
                        >
                           <SelectTrigger className="w-24 h-7 text-xs border-viewerborder">
                              <SelectValue />
                           </SelectTrigger>
                           <SelectContent align="end">
                              {BUCKET_ROLES.map((r) => (
                                 <SelectItem
                                    key={r.value}
                                    value={r.value}
                                    className="text-xs"
                                 >
                                    {r.label}
                                 </SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     )}
                  </div>
               );
            })}
         </div>
         {bucketAccessList.length === 0 && (
            <p className="text-xs text-red-500">
               Select at least one bucket for the invite.
            </p>
         )}
      </div>
   );
};

export default BucketAccessPicker;
