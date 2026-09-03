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
import {
   Select,
   SelectContent,
   SelectTrigger,
   SelectValue,
} from "@s3-viewer/ui/components/select";
import { Spinner } from "@s3-viewer/ui/components/spinner";
import { ChevronDown, X } from "lucide-react";
import { useState } from "react";
import BucketAccessPicker from "./bucket-access-picker";
import RoleSelectItems from "./role-options";

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
   expanded: boolean;
   onToggle: () => void;
};

const MemberRow = ({
   serverId,
   myRole,
   buckets,
   isBucketsLoading,
   member,
   isMe,
   expanded,
   onToggle,
}: MemberRowProps) => {
   const [access, setAccess] = useState<BucketAccessEntry[]>(
      member.bucketAccess
   );
   const [dirty, setDirty] = useState(false);
   const updateRole = useUpdateRole();
   const removeMember = useRemoveMember();
   const busy = updateRole.isPending || removeMember.isPending;

   const manageable = !isMe && canManageRole(myRole, member.role);
   const panelId = `member-${member.id}-buckets`;

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
      <li className="flex flex-col rounded-lg border border-viewerborder p-2">
         <div className="flex items-center gap-2">
            {manageable ? (
               <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  aria-label={`${expanded ? "Hide" : "Show"} bucket access for ${member.name}`}
                  onClick={onToggle}
                  className="rounded p-1 text-viewerlighttext hover:bg-viewergray hover:text-viewerblack"
               >
                  <ChevronDown
                     aria-hidden="true"
                     className={`size-4 transition-transform ${expanded ? "" : "-rotate-90"}`}
                  />
               </button>
            ) : (
               <span className="size-6 shrink-0" />
            )}
            <Avatar name={member.name} image={member.image} size={32} />
            <div className="flex min-w-0 flex-1 flex-col">
               <span className="truncate text-sm text-viewerblack">
                  {member.name}
                  {isMe && <span className="text-viewerlighttext"> (you)</span>}
               </span>
               <span className="truncate text-xs text-viewerlighttext">
                  {member.email}
                  {member.role !== Role.OWNER &&
                     ` · ${pluralize(member.bucketAccess.length, "bucket")}`}
               </span>
            </div>
            {manageable ? (
               <div className="flex shrink-0 items-center gap-1">
                  <Select
                     value={member.role}
                     disabled={busy}
                     onValueChange={(v) => changeRole(v as GrantableRole)}
                  >
                     <SelectTrigger
                        size="sm"
                        className="h-8 w-24 text-xs"
                        aria-label={`Role for ${member.name}`}
                     >
                        <SelectValue />
                     </SelectTrigger>
                     <SelectContent align="end" className="max-w-64">
                        <RoleSelectItems roles={assignableRoles(myRole)} />
                     </SelectContent>
                  </Select>
                  <Button
                     type="button"
                     variant="ghost"
                     size="icon"
                     className="size-8 text-viewerlighttext hover:text-viewertextred"
                     aria-label={`Remove ${member.name}`}
                     loading={removeMember.isPending}
                     disabled={busy}
                     onClick={() =>
                        removeMember.mutate({ serverId, userId: member.id })
                     }
                  >
                     {!removeMember.isPending && (
                        <X aria-hidden="true" className="size-4" />
                     )}
                  </Button>
               </div>
            ) : (
               <span className="shrink-0 text-xs text-viewertext">
                  {ROLE_LABELS[member.role]}
               </span>
            )}
         </div>
         {manageable && expanded && (
            <div id={panelId} className="mt-2 flex flex-col gap-2 pl-8">
               <BucketAccessPicker
                  legend={`Bucket access for ${member.name}`}
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
                     {updateRole.isPending ? "Saving…" : "Save changes"}
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
   const [expandedId, setExpandedId] = useState<string | null>(null);

   return (
      <section
         className="flex flex-col gap-2"
         aria-labelledby="members-heading"
      >
         <h3
            id="members-heading"
            className="text-sm font-medium text-viewerblack"
         >
            Members{!isLoading && ` (${members.length})`}
         </h3>
         {isLoading ? (
            <div className="flex h-[116px] items-center justify-center">
               <Spinner label="Loading members" />
            </div>
         ) : error ? (
            <p role="alert" className="text-sm text-viewertextred">
               {error.message}
            </p>
         ) : (
            <ul className="fade-in flex flex-col gap-1">
               {members.map((member) => (
                  <MemberRow
                     key={`${member.id}:${dataUpdatedAt}`}
                     serverId={serverId}
                     myRole={myRole}
                     buckets={buckets}
                     isBucketsLoading={isBucketsLoading}
                     member={member}
                     isMe={member.id === myUserId}
                     expanded={expandedId === member.id}
                     onToggle={() =>
                        setExpandedId((cur) =>
                           cur === member.id ? null : member.id
                        )
                     }
                  />
               ))}
            </ul>
         )}
      </section>
   );
};

export default Members;
