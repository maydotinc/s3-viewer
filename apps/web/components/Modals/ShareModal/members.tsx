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
import { Spinner } from "@s3-viewer/ui/components/spinner";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { useState } from "react";
import BucketAccessPicker from "./bucket-access-picker";
import RoleSelect from "./role-select";
import Section from "./section";

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
   const showBuckets = member.role !== Role.OWNER;
   const bucketCount = pluralize(member.bucketAccess.length, "bucket");

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
      <li className="min-w-0 py-2.5">
         <div className="flex min-w-0 items-center gap-3">
            <Avatar name={member.name} image={member.image} size={32} />
            <div className="flex min-w-0 flex-1 flex-col">
               <span className="min-w-0 truncate text-sm text-viewerblack">
                  {member.name}
                  {isMe && <span className="text-viewerlighttext"> (you)</span>}
               </span>
               <span className="min-w-0 truncate text-xs text-viewerlighttext">
                  {member.email}
                  {showBuckets && !manageable && ` · ${bucketCount}`}
               </span>
            </div>
            {manageable ? (
               <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => setOpen((v) => !v)}
                  className="flex w-24 shrink-0 cursor-pointer items-center gap-0.5 rounded-md border border-transparent px-1.5 py-1 text-xs text-viewerlighttext outline-none transition-colors hover:bg-viewergray hover:text-viewerblack focus-visible:border-viewerblue"
               >
                  {open ? (
                     <ChevronDown aria-hidden="true" className="size-3.5" />
                  ) : (
                     <ChevronRight aria-hidden="true" className="size-3.5" />
                  )}
                  <span className="min-w-0 truncate">{bucketCount}</span>
               </button>
            ) : (
               <span aria-hidden="true" className="w-24 shrink-0" />
            )}
            {manageable ? (
               <RoleSelect
                  className="w-32 shrink-0"
                  label={`Role for ${member.name}`}
                  value={member.role}
                  roles={assignableRoles(myRole)}
                  disabled={busy}
                  onChange={(next) => changeRole(next as GrantableRole)}
               />
            ) : (
               <span className="w-32 shrink-0 truncate px-3 text-sm text-viewertext">
                  {ROLE_LABELS[member.role]}
               </span>
            )}
            {manageable ? (
               <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-viewerlighttext not-disabled:hover:text-viewertextred"
                  aria-label={`Remove ${member.name}`}
                  loading={removeMember.isPending}
                  disabled={busy}
                  onClick={() =>
                     removeMember.mutate({ serverId, userId: member.id })
                  }
               >
                  <X aria-hidden="true" className="size-4" />
               </Button>
            ) : (
               <span aria-hidden="true" className="size-8 shrink-0" />
            )}
         </div>
         {manageable && open && (
            <div id={panelId} className="mt-2 flex min-w-0 flex-col gap-2">
               <BucketAccessPicker
                  label={`Bucket access for ${member.name}`}
                  myRole={myRole}
                  buckets={buckets}
                  isLoading={isBucketsLoading}
                  value={access}
                  onChange={editAccess}
                  disabled={busy}
               />
               {dirty && (
                  <Button
                     type="button"
                     size="sm"
                     className="self-end"
                     loading={updateRole.isPending}
                     onClick={saveAccess}
                     disabled={access.length === 0}
                  >
                     Save changes
                  </Button>
               )}
            </div>
         )}
      </li>
   );
};

const Members = ({
   serverId,
   myRole,
   buckets,
   isBucketsLoading,
}: MembersProps) => {
   const { members, isLoading, error, dataUpdatedAt } = useMembers(serverId);
   const myUserId = useUserId();

   return (
      <Section title={isLoading ? "Members" : `Members (${members.length})`}>
         {isLoading ? (
            <div className="flex h-24 items-center justify-center">
               <Spinner label="Loading members" />
            </div>
         ) : error ? (
            <p
               role="alert"
               className="flex h-24 items-center justify-center px-3 text-center text-sm text-viewertextred"
            >
               {error.message}
            </p>
         ) : (
            <ul className="flex min-w-0 flex-col divide-y divide-viewerborder">
               {members.map((member) => (
                  <MemberRow
                     key={`${member.id}:${dataUpdatedAt}`}
                     serverId={serverId}
                     myRole={myRole}
                     buckets={buckets}
                     isBucketsLoading={isBucketsLoading}
                     member={member}
                     isMe={member.id === myUserId}
                  />
               ))}
            </ul>
         )}
      </Section>
   );
};

export default Members;
