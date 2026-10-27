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
import type { ManagedInvite } from "@s3-viewer/shared";
import { TableRow } from "@s3-viewer/ui/components/table";
import { MailOpen } from "lucide-react";

type PendingInvitesProps = {
   serverId: string;
   invites: ManagedInvite[];
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
   invites,
   isLoading,
}: PendingInvitesProps) => (
   <InviteTable columns={COLUMNS} actionsWidth="w-24" loading={isLoading}>
      {isLoading ? null : invites.length === 0 ? (
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
                  {invite.canRevoke && (
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

export default PendingInvites;
