import { ApiError } from "@/lib/api";
import useAcceptInvite from "@/lib/hooks/mutations/invites/useAcceptInvite";
import useRejectInvite from "@/lib/hooks/mutations/invites/useRejectInvite";
import { useReceivedInvites } from "@/lib/hooks/queries/server/useInvites";
import { useUserId } from "@/lib/stores/sessionStore";
import { ErrorCode } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { TableCell, TableRow } from "@s3-viewer/ui/components/table";
import { MailOpen } from "lucide-react";
import SettingsCard from "./card";
import EmptyState from "./empty-state";
import UnverifiedCallout from "./unverified-callout";
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
   { label: "Role" },
   { label: "Invited by" },
   { label: "Expires", align: "right" },
];

const ReceivedInvites = () => {
   const userId = useUserId();
   const { data: invites, isLoading, error } = useReceivedInvites();
   const accept = useAcceptInvite();
   const reject = useRejectInvite();

   const body = () => {
      if (!userId || isLoading) {
         return (
            <InviteTable columns={COLUMNS}>
               <InviteTableSkeleton columns={COLUMNS.length} actions="pair" />
            </InviteTable>
         );
      }
      if (
         error instanceof ApiError &&
         error.code === ErrorCode.EMAIL_UNVERIFIED
      ) {
         return (
            <div className="px-6 pt-4 pb-6">
               <UnverifiedCallout>
                  Verify your email address to see the invites sent to it.
               </UnverifiedCallout>
            </div>
         );
      }
      if (error) return <InviteTableError message={error.message} />;
      if (!invites || invites.length === 0) {
         return (
            <EmptyState icon={MailOpen}>No invites waiting for you</EmptyState>
         );
      }
      return (
         <InviteTable columns={COLUMNS}>
            {invites.map((invite) => {
               const accepting =
                  accept.isPending && accept.variables?.inviteId === invite.id;
               const declining =
                  reject.isPending && reject.variables?.inviteId === invite.id;
               return (
                  <TableRow key={invite.id}>
                     <TableCell className="font-medium">
                        {invite.server.name}
                     </TableCell>
                     <RoleCell role={invite.role} />
                     <TableCell className="text-viewertext">
                        {invite.invitedBy.name}
                     </TableCell>
                     <ExpiresCell expiresAt={invite.expiresAt} />
                     <TableCell>
                        <div className="flex justify-end gap-2">
                           <Button
                              size="sm"
                              loading={accepting}
                              disabled={declining}
                              onClick={() =>
                                 accept.mutate({ inviteId: invite.id })
                              }
                           >
                              Accept
                           </Button>
                           <Button
                              size="sm"
                              variant="ghost"
                              loading={declining}
                              disabled={accepting}
                              onClick={() =>
                                 reject.mutate({ inviteId: invite.id })
                              }
                           >
                              Decline
                           </Button>
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
         title="Received"
         description="Servers other people have invited you to."
      >
         {body()}
      </SettingsCard>
   );
};

export default ReceivedInvites;
