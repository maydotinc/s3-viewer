import {
   ActionsCell,
   ExpiresCell,
   InviteTable,
   RevokeInviteButton,
   RoleCell,
   TextCell,
   type Column,
} from "@/components/invite-table";
import { EmptyRow } from "@/components/Layout/table-states";
import { canRemoveAccess } from "@s3-viewer/permissions";
import type { Role, ServerInvite } from "@s3-viewer/types";
import { TableRow } from "@s3-viewer/ui/components/table";
import { MailOpen } from "lucide-react";

type PendingInvitesProps = {
   serverId: string;
   myRole: Role;
   invites: ServerInvite[];
   isLoading: boolean;
};

const COLUMNS: readonly Column[] = [
   { label: "Email" },
   { label: "Role", width: "w-28" },
   { label: "Sent by", width: "w-40" },
   { label: "Expires", align: "right", width: "w-32" },
];

const PendingInvites = ({
   serverId,
   myRole,
   invites,
   isLoading,
}: PendingInvitesProps) => {
   return (
      <InviteTable columns={COLUMNS} actionsWidth="w-24" loading={isLoading}>
         {invites.length === 0 ? (
            <EmptyRow colSpan={COLUMNS.length + 1} icon={MailOpen}>
               No pending invites
            </EmptyRow>
         ) : (
            invites.map((invite) => (
               <TableRow key={invite.id}>
                  <TextCell strong>{invite.email}</TextCell>
                  <RoleCell
                     role={invite.role}
                     bucketAccess={invite.bucketAccess}
                  />
                  <TextCell label="Sent by">{invite.invitedBy.name}</TextCell>
                  <ExpiresCell expiresAt={invite.expiresAt} />
                  <ActionsCell>
                     {canRemoveAccess(
                        myRole,
                        invite.role,
                        invite.bucketAccess.map((grant) => grant.role)
                     ) && (
                        <RevokeInviteButton
                           serverId={serverId}
                           inviteId={invite.id}
                           email={invite.email}
                        />
                     )}
                  </ActionsCell>
               </TableRow>
            ))
         )}
      </InviteTable>
   );
};

export default PendingInvites;
