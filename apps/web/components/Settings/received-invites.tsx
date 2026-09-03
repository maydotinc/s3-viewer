import { ApiError } from "@/lib/api";
import useAcceptInvite from "@/lib/hooks/mutations/invites/useAcceptInvite";
import useRejectInvite from "@/lib/hooks/mutations/invites/useRejectInvite";
import { useReceivedInvites } from "@/lib/hooks/queries/server/useInvites";
import { useUserId } from "@/lib/stores/sessionStore";
import { ErrorCode, SITE_PATHS } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { TableCell, TableRow } from "@s3-viewer/ui/components/table";
import { MailOpen } from "lucide-react";
import Link from "next/link";
import SettingsCard from "./card";
import EmptyState from "./empty-state";
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
               <InviteTableSkeleton columns={COLUMNS.length} />
            </InviteTable>
         );
      }
      if (
         error instanceof ApiError &&
         error.code === ErrorCode.EMAIL_UNVERIFIED
      ) {
         return (
            <div className="flex flex-col items-center gap-3 border-t border-viewerborder py-16 text-center">
               <p className="max-w-sm text-sm text-viewertext">
                  Verify your email to see invites. Sign in with the code we
                  email you to verify it.
               </p>
               <Button asChild variant="outline">
                  <Link href={SITE_PATHS.login}>Sign in with email</Link>
               </Button>
            </div>
         );
      }
      if (error) return <InviteTableError message={error.message} />;
      if (!invites || invites.length === 0) {
         return (
            <div className="border-t border-viewerborder">
               <EmptyState icon={MailOpen}>
                  No invites waiting for you
               </EmptyState>
            </div>
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
