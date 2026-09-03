import Avatar from "@/components/Avatar";
import useRemoveMember from "@/lib/hooks/mutations/invites/useRemoveMember";
import useUpdateRole from "@/lib/hooks/mutations/invites/useUpdateRole";
import useMembers from "@/lib/hooks/queries/server/useMembers";
import { useUserId } from "@/lib/stores/sessionStore";
import { pluralize } from "@/lib/utils/format";
import {
   ROLE_LABELS,
   assignableRoles,
   canManageRole,
} from "@s3-viewer/permissions";
import {
   BucketAccessEntry,
   GrantableRole,
   Role,
   S3Bucket,
   ServerUser,
} from "@s3-viewer/types";
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
import { Fragment, useState } from "react";
import BucketAccessPicker from "./bucket-access-picker";
import Card from "./card";
import EmptyState from "./empty-state";
import { focusInviteEmails } from "./invite-focus";
import RoleSelect from "./role-select";

type GrantableAccess = { bucketName: string; role: GrantableRole }[];

type MembersProps = {
   serverId: string;
   myRole: Role;
   buckets: S3Bucket[];
   isBucketsLoading: boolean;
};

type MemberRowProps = MembersProps & {
   member: ServerUser;
   isMe: boolean;
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
   const [access, setAccess] = useState<BucketAccessEntry[]>(
      member.bucketAccess
   );
   const [dirty, setDirty] = useState(false);
   const [open, setOpen] = useState(false);
   const updateRole = useUpdateRole();
   const removeMember = useRemoveMember();
   const busy = updateRole.isPending || removeMember.isPending;

   const manageable = !isMe && canManageRole(myRole, member.role);
   const panelId = `member-${member.id}-buckets`;
   // Owners implicitly hold every bucket, so a count would be misleading.
   const isOwner = member.role === Role.OWNER;
   const bucketSummary = isOwner
      ? "All buckets"
      : pluralize(member.bucketAccess.length, "bucket");

   const editAccess = (next: BucketAccessEntry[]) => {
      setAccess(next);
      setDirty(true);
   };

   const changeRole = (role: GrantableRole) =>
      updateRole.mutate({
         serverId,
         userId: member.id,
         role,
         bucketAccess: dirty ? (access as GrantableAccess) : undefined,
      });

   const saveAccess = () =>
      updateRole.mutate(
         {
            serverId,
            userId: member.id,
            role: member.role as GrantableRole,
            bucketAccess: access as GrantableAccess,
         },
         { onSuccess: () => setDirty(false) }
      );

   return (
      <Fragment>
         <TableRow className={open ? "border-0" : undefined}>
            <TableCell className="min-w-0 whitespace-normal">
               <div className="flex min-w-0 items-center gap-3">
                  <Avatar
                     name={member.name}
                     image={member.image}
                     size={32}
                     className="size-8"
                  />
                  <div className="flex min-w-0 flex-col">
                     <span className="min-w-0 truncate text-sm leading-5 text-viewerblack">
                        {member.name}
                        {isMe && (
                           <span className="text-viewerlighttext"> (you)</span>
                        )}
                     </span>
                     <span className="min-w-0 truncate text-xs leading-4 text-viewerlighttext">
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
                     onChange={(next) => changeRole(next as GrantableRole)}
                  />
               ) : (
                  <span className="text-sm text-viewertext">
                     {ROLE_LABELS[member.role]}
                  </span>
               )}
            </TableCell>
            <TableCell>
               <div className="flex items-center gap-2">
                  <span className="text-sm text-viewertext">
                     {bucketSummary}
                  </span>
                  {manageable && !isOwner && (
                     <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-expanded={open}
                        aria-controls={panelId}
                        disabled={busy}
                        onClick={() => setOpen((v) => !v)}
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
            </TableCell>
         </TableRow>
         {manageable && open && (
            <TableRow className="h-auto hover:bg-transparent">
               <TableCell
                  colSpan={COLUMNS}
                  className="h-auto px-4 pt-0 pb-4 whitespace-normal"
               >
                  <div
                     id={panelId}
                     className="flex min-w-0 flex-col gap-2 pl-11"
                  >
                     <BucketAccessPicker
                        label={`Bucket access for ${member.name}`}
                        myRole={myRole}
                        buckets={buckets}
                        isLoading={isBucketsLoading}
                        value={access}
                        onChange={editAccess}
                        disabled={busy}
                     />
                     <Button
                        type="button"
                        size="sm"
                        className="self-end"
                        loading={updateRole.isPending}
                        onClick={saveAccess}
                        disabled={!dirty || access.length === 0}
                     >
                        Save
                     </Button>
                  </div>
               </TableCell>
            </TableRow>
         )}
      </Fragment>
   );
};

const MembersTable = ({ children }: { children: React.ReactNode }) => (
   <Table className="min-w-[688px] table-fixed">
      <TableHeader>
         <TableRow>
            <TableHead className="min-w-56">Member</TableHead>
            <TableHead className="w-44">Role</TableHead>
            <TableHead className="w-56">Bucket access</TableHead>
            <TableHead className="relative w-16 text-right">
               <span className="sr-only">Actions</span>
            </TableHead>
         </TableRow>
      </TableHeader>
      <TableBody>{children}</TableBody>
   </Table>
);

const SkeletonRows = () => (
   <>
      {[0, 1, 2].map((row) => (
         <TableRow key={row}>
            <TableCell>
               <div className="flex items-center gap-3">
                  <Skeleton className="size-8 rounded-full" />
                  <Skeleton className="h-4 w-40" />
               </div>
            </TableCell>
            <TableCell>
               <Skeleton className="h-4 w-20" />
            </TableCell>
            <TableCell>
               <Skeleton className="h-4 w-16" />
            </TableCell>
            <TableCell />
         </TableRow>
      ))}
   </>
);

const Members = ({
   serverId,
   myRole,
   buckets,
   isBucketsLoading,
}: MembersProps) => {
   const { members, isLoading, error, dataUpdatedAt } = useMembers(serverId);
   const myUserId = useUserId();

   return (
      <Card title={isLoading ? "Members" : `Members (${members.length})`} flush>
         {error ? (
            <p
               role="alert"
               className="border-t border-viewerborder px-6 py-16 text-center text-sm text-viewertextred"
            >
               {error.message}
            </p>
         ) : (
            <MembersTable>
               {isLoading ? (
                  <SkeletonRows />
               ) : members.length === 0 ? (
                  <TableRow className="h-auto hover:bg-transparent">
                     <TableCell
                        colSpan={COLUMNS}
                        className="h-auto p-0 whitespace-normal"
                     >
                        <EmptyState
                           icon={Users}
                           message="No members yet"
                           actionLabel="Invite people"
                           onAction={focusInviteEmails}
                        />
                     </TableCell>
                  </TableRow>
               ) : (
                  members.map((member) => (
                     <MemberRow
                        key={`${member.id}:${dataUpdatedAt}`}
                        serverId={serverId}
                        myRole={myRole}
                        buckets={buckets}
                        isBucketsLoading={isBucketsLoading}
                        member={member}
                        isMe={member.id === myUserId}
                     />
                  ))
               )}
            </MembersTable>
         )}
      </Card>
   );
};

export default Members;
