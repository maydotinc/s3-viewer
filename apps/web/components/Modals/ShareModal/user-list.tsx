import useBuckets from "@/lib/hooks/queries/s3/useBuckets";
import useDeleteRole from "@/lib/hooks/mutations/invites/useDeleteRole";
import useUpdateRole from "@/lib/hooks/mutations/invites/useUpdateRole";
import useServerUsers from "@/lib/hooks/queries/server/useServerUsers";
import useSessionStore from "@/lib/stores/sessionStore";
import { BucketAccessEntry, Role } from "@s3-viewer/types";
import { Badge } from "@s3-viewer/ui/components/badge";
import { Checkbox } from "@s3-viewer/ui/components/checkbox";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@s3-viewer/ui/components/select";
import { ChevronDown, ChevronRight, User } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { useShareContext } from "./context/ShareContext";
import RoleSelector from "./fields/role-input";

const BUCKET_ROLES: { value: Role; label: string }[] = [
   { value: Role.VIEWER, label: "Read" },
   { value: Role.EDITOR, label: "Write" },
   { value: Role.ADMIN, label: "Admin" },
];

const UserBucketEditor = ({
   userId,
   serverId,
   userRole,
   currentBucketAccess,
}: {
   userId: string;
   serverId: string;
   userRole: Role;
   currentBucketAccess: BucketAccessEntry[];
}) => {
   const { buckets } = useBuckets(serverId);
   const updateRoleMutation = useUpdateRole();
   const [localAccess, setLocalAccess] =
      useState<BucketAccessEntry[]>(currentBucketAccess);
   const [dirty, setDirty] = useState(false);

   const isBucketSelected = (bucketName: string) =>
      localAccess.some((ba) => ba.bucketName === bucketName);

   const getBucketRole = (bucketName: string): Role =>
      localAccess.find((ba) => ba.bucketName === bucketName)?.role ??
      Role.VIEWER;

   const toggleBucket = (bucketName: string) => {
      const newAccess = isBucketSelected(bucketName)
         ? localAccess.filter((ba) => ba.bucketName !== bucketName)
         : [...localAccess, { bucketName, role: Role.VIEWER }];
      setLocalAccess(newAccess);
      setDirty(true);
   };

   const updateBucketRole = (bucketName: string, role: Role) => {
      const newAccess = localAccess.map((ba) =>
         ba.bucketName === bucketName ? { ...ba, role } : ba
      );
      setLocalAccess(newAccess);
      setDirty(true);
   };

   const handleSave = () => {
      updateRoleMutation.mutate(
         {
            serverId,
            userId,
            role: userRole,
            bucketAccess: localAccess,
         },
         {
            onSuccess: () => setDirty(false),
         }
      );
   };

   return (
      <div className="flex flex-col gap-1 pl-13 pr-2 pb-2">
         <div className="max-h-36 overflow-y-auto border border-viewerborder rounded-lg">
            {buckets.map((bucket) => {
               const selected = isBucketSelected(bucket.Name);
               return (
                  <div
                     key={bucket.Name}
                     className="flex items-center justify-between px-2 py-1.5 hover:bg-gray-50 border-b border-viewerborder last:border-b-0"
                  >
                     <div className="flex items-center gap-2 min-w-0">
                        <Checkbox
                           checked={selected}
                           onCheckedChange={() => toggleBucket(bucket.Name)}
                        />
                        <span className="text-xs text-black truncate">
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
                           <SelectTrigger className="w-20 h-6 text-xs border-viewerborder">
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
         {dirty && (
            <button
               onClick={handleSave}
               disabled={updateRoleMutation.isPending}
               className="self-end text-xs text-viewerblue hover:underline mt-1 disabled:opacity-50"
            >
               {updateRoleMutation.isPending ? "Saving..." : "Save changes"}
            </button>
         )}
      </div>
   );
};

const UserList = () => {
   const { serverId } = useShareContext();
   const { serverUsers } = useServerUsers(serverId);
   const userId = useSessionStore((state) => state.userId);
   const users = serverUsers.filter((user) => user.id !== userId);
   const deleteRoleMutation = useDeleteRole();
   const updateRoleMutation = useUpdateRole();
   const [expandedUser, setExpandedUser] = useState<string | null>(null);

   const handleRoleChange = (userId: string, newRole: Role) => {
      updateRoleMutation.mutate({ serverId, userId, role: newRole });
   };

   const handleRemove = (userId: string, userRole: Role) => {
      deleteRoleMutation.mutate({ serverId, userId, role: userRole });
   };

   if (!users || users.length === 0) {
      return (
         <div className="flex flex-col gap-2 w-full p-2">
            <p className="text-viewerblack text-center text-sm">
               No users have access to this server
            </p>
         </div>
      );
   }

   return (
      <div className="flex flex-col gap-2 w-full py-2">
         {users.map((user) => (
            <div key={user.id} className="flex flex-col">
               <div className="flex flex-row w-full items-center justify-between">
                  <div className="flex flex-row items-center gap-3">
                     {user.role !== Role.OWNER && (
                        <button
                           onClick={() =>
                              setExpandedUser(
                                 expandedUser === user.id ? null : user.id
                              )
                           }
                           className="p-0.5 hover:bg-gray-100 rounded"
                        >
                           {expandedUser === user.id ? (
                              <ChevronDown className="size-3.5 text-gray-500" />
                           ) : (
                              <ChevronRight className="size-3.5 text-gray-500" />
                           )}
                        </button>
                     )}
                     {user?.image ? (
                        <Image
                           src={user.image}
                           alt="Profile"
                           width={40}
                           height={40}
                           className="size-10 rounded-full object-cover min-w-10"
                        />
                     ) : (
                        <User className="size-10 rounded-full bg-blue-400 p-1 min-w-10 text-viewergray" />
                     )}
                     <div className="flex flex-col items-start justify-start">
                        <p className="truncate max-w-[200px] text-black">
                           {user?.name}
                        </p>
                        <div className="flex items-center gap-1">
                           <p className="text-xs max-w-[140px] truncate text-gray-500">
                              {user?.email}
                           </p>
                           {user.role !== Role.OWNER && (
                              <Badge
                                 variant="secondary"
                                 className="text-[10px] px-1 py-0"
                              >
                                 {user.bucketAccess?.length ?? 0} bucket
                                 {(user.bucketAccess?.length ?? 0) !== 1
                                    ? "s"
                                    : ""}
                              </Badge>
                           )}
                        </div>
                     </div>
                  </div>
                  <div>
                     <RoleSelector
                        disabled={
                           user.role === Role.OWNER ||
                           deleteRoleMutation.isPending ||
                           updateRoleMutation.isPending
                        }
                        value={user.role}
                        onValueChange={(newRole) =>
                           handleRoleChange(user.id, newRole)
                        }
                        mode="manage"
                        className="w-fit hover:bg-gray-50 border-none shadow-none bg-transparent"
                        onRemove={() => handleRemove(user.id, user.role)}
                     />
                  </div>
               </div>
               {expandedUser === user.id && user.role !== Role.OWNER && (
                  <UserBucketEditor
                     userId={user.id}
                     serverId={serverId}
                     userRole={user.role}
                     currentBucketAccess={user.bucketAccess ?? []}
                  />
               )}
            </div>
         ))}
      </div>
   );
};

export default UserList;
