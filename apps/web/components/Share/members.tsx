import Avatar from "@/components/avatar";
import FolderLimitNote from "@/components/folder-limit-note";
import {
   EmptyRow,
   STACKED_LABEL,
   STACKED_TABLE,
} from "@/components/Layout/table-states";
import ListPagination, {
   type LoadMoreQuery,
} from "@/components/list-pagination";
import { ConfirmButton } from "@/components/Modals/confirm-button";
import useRemoveMember from "@/lib/hooks/mutations/invites/useRemoveMember";
import useUpdateRole from "@/lib/hooks/mutations/invites/useUpdateRole";
import TableSkeletonRows from "@/components/table-skeleton";
import { useUserId } from "@/lib/stores/session-store";
import { pluralize } from "@/lib/utils/format";
import {
   ROLE_LABELS,
   assignableRoles,
   canManageRole,
   canRemoveAccess,
} from "@s3-viewer/permissions";
import {
   Role,
   type GrantableRole,
   type S3Bucket,
   type ServerUser,
} from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
} from "@s3-viewer/ui/components/table";
import { cn } from "@s3-viewer/ui/lib/utils";
import { Users, X } from "lucide-react";
import { useState } from "react";
import BucketAccessDialog from "./bucket-access-dialog";
import RoleSelect from "./role-select";

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
   pages: LoadMoreQuery;
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
   const removable =
      !isMe &&
      canRemoveAccess(
         myRole,
         member.role,
         member.bucketAccess.map((grant) => grant.role)
      );
   const isOwner = member.role === Role.OWNER;
   const bucketSummary = isOwner
      ? "All buckets"
      : pluralize(member.bucketAccess.length, "bucket");

   return (
      <TableRow className="h-16">
         <TableCell className="md:px-6">
            <div className="flex min-w-0 items-center gap-3">
               <Avatar name={member.name} />
               <div className="flex min-w-0 flex-col">
                  <span
                     title={member.name}
                     className="min-w-0 truncate text-sm text-viewerblack"
                  >
                     {member.name}
                     {isMe && (
                        <span className="text-viewerlighttext"> (you)</span>
                     )}
                  </span>
                  <span
                     title={member.email}
                     className="min-w-0 truncate text-xs text-viewerlighttext"
                  >
                     {member.email}
                  </span>
               </div>
            </div>
         </TableCell>
         <TableCell
            data-label="Role"
            className={cn(STACKED_LABEL, "max-md:flex! max-md:items-center")}
         >
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
         <TableCell
            data-label="Access"
            className={cn(STACKED_LABEL, "max-md:flex! max-md:items-center")}
         >
            <div className="flex min-w-0 items-center gap-2">
               <div className="flex min-w-0 flex-col">
                  <span className="text-viewertext">{bucketSummary}</span>
                  {!isOwner && (
                     <FolderLimitNote entries={member.bucketAccess} />
                  )}
               </div>
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
            {removable && (
               <ConfirmButton
                  tooltip={`Remove ${member.name}`}
                  variant="ghost"
                  size="icon-sm"
                  className="text-viewerlighttext not-disabled:hover:text-viewertextred"
                  aria-label={`Remove ${member.name}`}
                  disabled={busy}
                  confirmTitle={`Remove ${member.name}`}
                  confirmDescription={`${member.name} loses access to this server and every bucket on it. To add them back, send a new invite.`}
                  confirmLabel="Remove"
                  isPending={removeMember.isPending}
                  onConfirm={(close) =>
                     removeMember.mutate(
                        { serverId, userId: member.id },
                        { onSuccess: close }
                     )
                  }
               >
                  <X aria-hidden="true" className="size-4" />
               </ConfirmButton>
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

const Members = ({ members, isLoading, pages, ...rowProps }: MembersProps) => {
   const myUserId = useUserId();

   return (
      <>
         <Table className={STACKED_TABLE} aria-busy={isLoading || undefined}>
            <TableHeader>
               <TableRow>
                  <TableHead className="md:px-6">Member</TableHead>
                  <TableHead className="w-44">Role</TableHead>
                  <TableHead className="w-56">Bucket access</TableHead>
                  <TableHead className="w-16">
                     <span className="sr-only">Actions</span>
                  </TableHead>
               </TableRow>
            </TableHeader>
            <TableBody>
               {isLoading ? (
                  <TableSkeletonRows
                     columns={Array.from({ length: COLUMNS }, () => ({}))}
                     rowClassName="h-16 [&>td:first-child]:md:px-6"
                  />
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
         {!isLoading && <ListPagination variant="footer" {...pages} />}
      </>
   );
};

export default Members;
