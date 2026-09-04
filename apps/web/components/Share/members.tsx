import Avatar from "@/components/Avatar";
import useRemoveMember from "@/lib/hooks/mutations/invites/useRemoveMember";
import useUpdateRole from "@/lib/hooks/mutations/invites/useUpdateRole";
import { useUserId } from "@/lib/stores/sessionStore";
import { pluralize } from "@/lib/utils/format";
import {
   ROLE_LABELS,
   assignableRoles,
   canManageRole,
} from "@s3-viewer/permissions";
import { GrantableRole, Role, S3Bucket, ServerUser } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "@s3-viewer/ui/components/table";
import { SimpleTooltip } from "@s3-viewer/ui/components/tooltip";
import { Users, X } from "lucide-react";
import { useState } from "react";
import BucketAccessDialog from "./bucket-access-dialog";
import RoleSelect from "./role-select";
import { EmptyRow } from "./table-states";

type MemberRowProps = {
   serverId: string;
   myRole: Role;
   buckets: S3Bucket[];
   isBucketsLoading: boolean;
   member: ServerUser;
   isMe: boolean;
};

type MembersProps = Omit<MemberRowProps, "member" | "isMe"> & {
   members: ServerUser[];
   isLoading: boolean;
};

const COLUMNS = 4;

const MemberRow = ({
   serverId,
   myRole,
   buckets,
   isBucketsLoading,
   member,
   isMe,
}: MemberRowProps) => {
   const [editing, setEditing] = useState(false);
   const updateRole = useUpdateRole();
   const removeMember = useRemoveMember();
   const busy = updateRole.isPending || removeMember.isPending;

   const manageable = !isMe && canManageRole(myRole, member.role);
   // owners implicitly hold every bucket, so a count would mislead
   const isOwner = member.role === Role.OWNER;
   const bucketSummary = isOwner
      ? "All buckets"
      : pluralize(member.bucketAccess.length, "bucket");

   return (
      <TableRow className="h-16">
         <TableCell className="px-6">
            <div className="flex min-w-0 items-center gap-3">
               <Avatar name={member.name} size={32} />
               <div className="flex min-w-0 flex-col">
                  <span className="min-w-0 truncate text-sm text-viewerblack">
                     {member.name}
                     {isMe && (
                        <span className="text-viewerlighttext"> (you)</span>
                     )}
                  </span>
                  <span className="min-w-0 truncate text-xs text-viewerlighttext">
                     {member.email}
                  </span>
               </div>
            </div>
         </TableCell>
         <TableCell>
            {manageable ? (
               <RoleSelect
                  className="w-36"
                  label={`Role for ${member.name}`}
                  value={member.role}
                  roles={assignableRoles(myRole)}
                  disabled={busy}
                  onChange={(next) =>
                     updateRole.mutate({
                        serverId,
                        userId: member.id,
                        role: next as GrantableRole,
                     })
                  }
               />
            ) : (
               <span className="text-viewertext">
                  {ROLE_LABELS[member.role]}
               </span>
            )}
         </TableCell>
         <TableCell>
            <div className="flex items-center gap-2">
               <span className="text-viewertext">{bucketSummary}</span>
               {manageable && !isOwner && (
                  <Button
                     type="button"
                     variant="ghost"
                     size="sm"
                     disabled={busy}
                     onClick={() => setEditing(true)}
                  >
                     Edit
                  </Button>
               )}
            </div>
         </TableCell>
         <TableCell className="text-right">
            {manageable && (
               <SimpleTooltip label={`Remove ${member.name}`}>
                  <Button
                     type="button"
                     variant="ghost"
                     size="icon-sm"
                     className="text-viewerlighttext not-disabled:hover:text-viewertextred"
                     aria-label={`Remove ${member.name}`}
                     loading={removeMember.isPending}
                     disabled={busy}
                     onClick={() =>
                        removeMember.mutate({ serverId, userId: member.id })
                     }
                  >
                     <X aria-hidden="true" className="size-4" />
                  </Button>
               </SimpleTooltip>
            )}
            {editing && (
               <BucketAccessDialog
                  serverId={serverId}
                  myRole={myRole}
                  buckets={buckets}
                  isBucketsLoading={isBucketsLoading}
                  member={member}
                  onClose={() => setEditing(false)}
               />
            )}
         </TableCell>
      </TableRow>
   );
};

const SkeletonRows = () =>
   [0, 1, 2].map((row) => (
      <TableRow key={row} className="h-16 hover:bg-transparent">
         <TableCell className="px-6">
            <div className="flex items-center gap-3">
               <Skeleton className="size-8 rounded-full" />
               <div className="flex flex-col gap-2">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-44" />
               </div>
            </div>
         </TableCell>
         <TableCell>
            <Skeleton className="h-3.5 w-16" />
         </TableCell>
         <TableCell>
            <Skeleton className="h-3.5 w-20" />
         </TableCell>
         <TableCell />
      </TableRow>
   ));

const Members = ({ members, isLoading, ...rowProps }: MembersProps) => {
   const myUserId = useUserId();

   return (
      <Table className="min-w-[720px] table-fixed">
         <TableHeader>
            <TableRow>
               <TableHead className="px-6">Member</TableHead>
               <TableHead className="w-44">Role</TableHead>
               <TableHead className="w-56">Bucket access</TableHead>
               <TableHead className="w-16">
                  <span className="sr-only">Actions</span>
               </TableHead>
            </TableRow>
         </TableHeader>
         <TableBody>
            {isLoading ? (
               <SkeletonRows />
            ) : members.length === 0 ? (
               <EmptyRow colSpan={COLUMNS} icon={Users}>
                  No members yet
               </EmptyRow>
            ) : (
               members.map((member) => (
                  <MemberRow
                     key={member.id}
                     member={member}
                     isMe={member.id === myUserId}
                     {...rowProps}
                  />
               ))
            )}
         </TableBody>
      </Table>
   );
};

export default Members;
