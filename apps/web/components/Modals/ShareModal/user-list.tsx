import useBuckets from "@/lib/hooks/queries/s3/useBuckets";
import useDeleteRole from "@/lib/hooks/mutations/invites/useDeleteRole";
import useUpdateRole from "@/lib/hooks/mutations/invites/useUpdateRole";
import useServerUsers from "@/lib/hooks/queries/server/useServerUsers";
import useSessionStore from "@/lib/stores/sessionStore";
import { BucketAccessEntry, Role } from "@s3-viewer/types";
import { Badge } from "@s3-viewer/ui/components/badge";
import { Button } from "@s3-viewer/ui/components/button";
import { Checkbox } from "@s3-viewer/ui/components/checkbox";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@s3-viewer/ui/components/select";
import { Separator } from "@s3-viewer/ui/components/separator";
import {
   Check,
   ChevronDown,
   ChevronRight,
   Loader2,
   ShieldCheck,
   User,
   Users,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { useShareContext } from "./context/ShareContext";
import RoleSelector from "./fields/role-input";

const BUCKET_ROLES: { value: Role; label: string }[] = [
   { value: Role.VIEWER, label: "Read" },
   { value: Role.EDITOR, label: "Write" },
   { value: Role.ADMIN, label: "Admin" },
];

const getInitials = (name: string) => {
   const parts = name.trim().split(/\s+/);
   if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
   return name.slice(0, 2).toUpperCase();
};

const AVATAR_COLORS = [
   "bg-blue-100 text-blue-700",
   "bg-purple-100 text-purple-700",
   "bg-green-100 text-green-700",
   "bg-amber-100 text-amber-700",
   "bg-rose-100 text-rose-700",
   "bg-cyan-100 text-cyan-700",
];

const getAvatarColor = (name: string) => {
   let hash = 0;
   for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
   }
   return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

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
   const [saved, setSaved] = useState(false);

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
      setSaved(false);
   };

   const updateBucketRole = (bucketName: string, role: Role) => {
      const newAccess = localAccess.map((ba) =>
         ba.bucketName === bucketName ? { ...ba, role } : ba
      );
      setLocalAccess(newAccess);
      setDirty(true);
      setSaved(false);
   };

   const allSelected = buckets.length > 0 && localAccess.length === buckets.length;

   const toggleAll = () => {
      if (allSelected) {
         setLocalAccess([]);
      } else {
         const newEntries: BucketAccessEntry[] = buckets.map((b) => ({
            bucketName: b.Name,
            role:
               localAccess.find((ba) => ba.bucketName === b.Name)?.role ??
               Role.VIEWER,
         }));
         setLocalAccess(newEntries);
      }
      setDirty(true);
      setSaved(false);
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
            onSuccess: () => {
               setDirty(false);
               setSaved(true);
               setTimeout(() => setSaved(false), 2000);
            },
         }
      );
   };

   return (
      <div className="flex flex-col gap-2 mt-2 mr-1 mb-2">
         <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
               Bucket permissions
            </span>
            <button
               type="button"
               onClick={toggleAll}
               className="text-[11px] text-viewerblue hover:underline"
            >
               {allSelected ? "Deselect all" : "Select all"}
            </button>
         </div>
         <div className="max-h-36 overflow-y-auto border border-viewerborder rounded-lg bg-white">
            {buckets.map((bucket) => {
               const selected = isBucketSelected(bucket.Name);
               return (
                  <div
                     key={bucket.Name}
                     className="flex items-center justify-between px-2.5 py-1.5 hover:bg-gray-50/80 transition-colors border-b border-viewerborder last:border-b-0"
                  >
                     <label className="flex items-center gap-2 min-w-0 cursor-pointer flex-1">
                        <Checkbox
                           checked={selected}
                           onCheckedChange={() => toggleBucket(bucket.Name)}
                        />
                        <span className="text-xs text-black truncate">
                           {bucket.Name}
                        </span>
                     </label>
                     {selected && (
                        <Select
                           value={getBucketRole(bucket.Name)}
                           onValueChange={(val) =>
                              updateBucketRole(bucket.Name, val as Role)
                           }
                        >
                           <SelectTrigger className="w-20 h-6 text-xs border-viewerborder ml-2 shrink-0">
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
         <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-400">
               {localAccess.length} of {buckets.length} bucket
               {buckets.length !== 1 ? "s" : ""} selected
            </span>
            {dirty ? (
               <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleSave}
                  disabled={updateRoleMutation.isPending}
                  className="h-8 text-xs px-3"
               >
                  {updateRoleMutation.isPending ? (
                     <>
                        <Loader2 className="size-3 animate-spin" />
                        Saving...
                     </>
                  ) : (
                     "Save changes"
                  )}
               </Button>
            ) : saved ? (
               <span className="flex items-center gap-1 text-xs text-green-600">
                  <Check className="size-3" />
                  Saved
               </span>
            ) : null}
         </div>
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
         <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Users className="size-8 text-gray-300" />
            <p className="text-sm text-gray-500">
               No other members on this server
            </p>
            <p className="text-xs text-gray-400">
               Invite someone above to get started
            </p>
         </div>
      );
   }

   return (
      <div className="flex flex-col w-full">
         <div className="flex items-center justify-between pb-2">
            <span className="text-xs font-medium text-gray-500">
               Members ({users.length})
            </span>
         </div>
         <Separator className="bg-viewerborder mb-2" />
         <div className="flex flex-col gap-1">
            {users.map((user) => {
               const isExpanded = expandedUser === user.id;
               const isNonOwner = user.role !== Role.OWNER;

               return (
                  <div
                     key={user.id}
                     className={`flex flex-col rounded-lg transition-colors border p-2 hover:bg-gray-50 ${isExpanded ? "bg-gray-50" : ""
                        }`}
                  >
                     <div
                        className={`flex flex-row w-full items-center justify-between p-1.5 rounded-lg ${isNonOwner
                           ? "cursor-pointer"
                           : ""
                           } transition-colors`}
                        onClick={() => {
                           if (isNonOwner)
                              setExpandedUser(isExpanded ? null : user.id);
                        }}
                     >
                        <div className="flex flex-row items-center gap-2.5 min-w-0 flex-1">
                           {isNonOwner && (
                              <div className="shrink-0 w-4 flex items-center justify-center">
                                 {isExpanded ? (
                                    <ChevronDown className="size-3.5 text-gray-400" />
                                 ) : (
                                    <ChevronRight className="size-3.5 text-gray-400" />
                                 )}
                              </div>
                           )}
                           {!isNonOwner && (
                              <div className="shrink-0 w-4" />
                           )}
                           {user?.image ? (
                              <Image
                                 src={user.image}
                                 alt={user.name}
                                 width={32}
                                 height={32}
                                 className="size-8 rounded-full object-cover shrink-0"
                              />
                           ) : (
                              <div
                                 className={`size-8 rounded-full flex items-center justify-center shrink-0 text-xs font-medium ${getAvatarColor(user.name)}`}
                              >
                                 {getInitials(user.name)}
                              </div>
                           )}
                           <div className="flex flex-col min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                 <span className="text-sm text-black truncate">
                                    {user.name}
                                 </span>
                                 {user.role === Role.OWNER && (
                                    <ShieldCheck className="size-3.5 text-viewerblue shrink-0" />
                                 )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                 <span className="text-xs text-gray-400 truncate">
                                    {user.email}
                                 </span>
                                 {isNonOwner && (
                                    <Badge
                                       variant="secondary"
                                       className="text-[10px] leading-none px-1.5 py-0 shrink-0"
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
                        <div
                           className="shrink-0"
                           onClick={(e) => e.stopPropagation()}
                        >
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
                              className="w-fit hover:bg-gray-100 border-none shadow-none bg-transparent text-xs"
                              onRemove={() =>
                                 handleRemove(user.id, user.role)
                              }
                           />
                        </div>
                     </div>
                     {isExpanded && isNonOwner && (
                        <UserBucketEditor
                           userId={user.id}
                           serverId={serverId}
                           userRole={user.role}
                           currentBucketAccess={user.bucketAccess ?? []}
                        />
                     )}
                  </div>
               );
            })}
         </div>
      </div>
   );
};

export default UserList;
