import useRevokeInvite from "@/lib/hooks/mutations/invites/useRevokeInvite";
import { useAllSentInvites } from "@/lib/hooks/queries/server/useInvites";
import { useUserId } from "@/lib/stores/sessionStore";
import { Button } from "@s3-viewer/ui/components/button";
import { TableCell, TableRow } from "@s3-viewer/ui/components/table";
import { SimpleTooltip } from "@s3-viewer/ui/components/tooltip";
import { Send, X } from "lucide-react";
import SettingsCard from "./card";
import EmptyState from "./empty-state";
import InvitePeople from "./invite-people";
import {
   ExpiresCell,
   InviteTable,
   InviteTableError,
   InviteTableSkeleton,
   RoleCell,
   type Column,
} from "./invite-table";

const COLUMNS: readonly Column[] = [
   { label: "Server" },
   { label: "Email" },
   { label: "Role" },
   { label: "Expires", align: "right" },
];

const SentInvites = () => {
   const userId = useUserId();
   const { data: invites, isLoading, error } = useAllSentInvites();
   const revoke = useRevokeInvite();

   const body = () => {
      if (!userId || isLoading) {
         return (
            <InviteTable columns={COLUMNS}>
               <InviteTableSkeleton columns={COLUMNS.length} actions="icon" />
            </InviteTable>
         );
      }
      if (error) return <InviteTableError message={error.message} />;
      if (!invites || invites.length === 0) {
         return <EmptyState icon={Send}>No pending invites</EmptyState>;
      }
      return (
         <InviteTable columns={COLUMNS}>
            {invites.map((invite) => {
               const revoking =
                  revoke.isPending && revoke.variables?.inviteId === invite.id;
               return (
                  <TableRow key={invite.id}>
                     <TableCell className="font-medium">
                        {invite.server.name}
                     </TableCell>
                     <TableCell className="text-viewertext">
                        {invite.email}
                     </TableCell>
                     <RoleCell role={invite.role} />
                     <ExpiresCell expiresAt={invite.expiresAt} />
                     <TableCell>
                        <div className="flex justify-end">
                           <SimpleTooltip label="Revoke invite">
                              <Button
                                 variant="ghost"
                                 size="icon-sm"
                                 aria-label="Revoke invite"
                                 loading={revoking}
                                 onClick={() =>
                                    revoke.mutate({
                                       serverId: invite.server.id,
                                       inviteId: invite.id,
                                    })
                                 }
                              >
                                 <X aria-hidden="true" />
                              </Button>
                           </SimpleTooltip>
                        </div>
                     </TableCell>
                  </TableRow>
               );
            })}
         </InviteTable>
      );
   };

   return (
      <SettingsCard
         flush
         title="Sent"
         description="Invites you've sent that haven't been accepted yet."
         action={<InvitePeople />}
      >
         {body()}
      </SettingsCard>
   );
};

export default SentInvites;
