import useRevokeInvite from "@/lib/hooks/mutations/invites/useRevokeInvite";
import { useSentInvites } from "@/lib/hooks/queries/server/useInvites";
import { useHydrated } from "@/lib/hooks/useHydrated";
import { formatDate, formatRelativeDay } from "@/lib/utils/format";
import { ROLE_LABELS } from "@s3-viewer/permissions";
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
import { MailOpen } from "lucide-react";
import Card from "./card";
import EmptyState from "./empty-state";
import { focusInviteEmails } from "./invite-focus";

const COLUMNS = 5;

const Expires = ({ expiresAt }: { expiresAt: string }) => {
   const hydrated = useHydrated();
   // The clock only exists on the client, so nothing relative is rendered
   // until after hydration.
   if (!hydrated) return <span>&nbsp;</span>;
   const expired = new Date(expiresAt).getTime() <= Date.now();
   return (
      <SimpleTooltip label={formatDate(expiresAt)}>
         <span className={expired ? "text-viewertextred" : "text-viewertext"}>
            {formatRelativeDay(expiresAt)}
         </span>
      </SimpleTooltip>
   );
};

const PendingInvites = ({ serverId }: { serverId: string }) => {
   const { data: invites = [], isLoading, error } = useSentInvites(serverId);
   const revoke = useRevokeInvite();

   return (
      <Card
         title={
            isLoading
               ? "Pending invites"
               : `Pending invites (${invites.length})`
         }
         flush
      >
         {error ? (
            <p
               role="alert"
               className="border-t border-viewerborder px-6 py-16 text-center text-sm text-viewertextred"
            >
               {error.message}
            </p>
         ) : (
            <Table className="min-w-[736px] table-fixed">
               <TableHeader>
                  <TableRow>
                     <TableHead className="min-w-56">Email</TableHead>
                     <TableHead className="w-28">Role</TableHead>
                     <TableHead className="w-40">Sent by</TableHead>
                     <TableHead className="w-36">Expires</TableHead>
                     <TableHead className="relative w-24 text-right">
                        <span className="sr-only">Revoke</span>
                     </TableHead>
                  </TableRow>
               </TableHeader>
               <TableBody>
                  {isLoading ? (
                     [0, 1].map((row) => (
                        <TableRow key={row}>
                           <TableCell>
                              <Skeleton className="h-4 w-48" />
                           </TableCell>
                           <TableCell>
                              <Skeleton className="h-4 w-16" />
                           </TableCell>
                           <TableCell>
                              <Skeleton className="h-4 w-24" />
                           </TableCell>
                           <TableCell>
                              <Skeleton className="h-4 w-20" />
                           </TableCell>
                           <TableCell />
                        </TableRow>
                     ))
                  ) : invites.length === 0 ? (
                     <TableRow className="h-auto hover:bg-transparent">
                        <TableCell
                           colSpan={COLUMNS}
                           className="h-auto p-0 whitespace-normal"
                        >
                           <EmptyState
                              icon={MailOpen}
                              message="No pending invites"
                              actionLabel="Invite people"
                              onAction={focusInviteEmails}
                           />
                        </TableCell>
                     </TableRow>
                  ) : (
                     invites.map((invite) => (
                        <TableRow key={invite.id}>
                           <TableCell className="min-w-0 truncate">
                              {invite.email}
                           </TableCell>
                           <TableCell className="text-viewertext">
                              {ROLE_LABELS[invite.role]}
                           </TableCell>
                           <TableCell className="min-w-0 truncate text-viewertext">
                              {invite.invitedBy.name}
                           </TableCell>
                           <TableCell>
                              <Expires expiresAt={invite.expiresAt} />
                           </TableCell>
                           <TableCell className="text-right">
                              <Button
                                 type="button"
                                 variant="ghost"
                                 size="sm"
                                 loading={
                                    revoke.isPending &&
                                    revoke.variables?.inviteId === invite.id
                                 }
                                 onClick={() =>
                                    revoke.mutate({
                                       serverId,
                                       inviteId: invite.id,
                                    })
                                 }
                              >
                                 Revoke
                              </Button>
                           </TableCell>
                        </TableRow>
                     ))
                  )}
               </TableBody>
            </Table>
         )}
      </Card>
   );
};

export default PendingInvites;
