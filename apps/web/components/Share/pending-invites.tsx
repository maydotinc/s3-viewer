import useRevokeInvite from "@/lib/hooks/mutations/invites/useRevokeInvite";
import { useHydrated } from "@/lib/hooks/useHydrated";
import { formatDate, formatRelativeDay } from "@/lib/utils/format";
import { ROLE_LABELS } from "@s3-viewer/permissions";
import { ServerInvite } from "@s3-viewer/types";
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
import { EmptyRow } from "./table-states";

type PendingInvitesProps = {
   serverId: string;
   invites: ServerInvite[];
   isLoading: boolean;
};

const COLUMNS = 5;

const Expires = ({ expiresAt }: { expiresAt: string }) => {
   const hydrated = useHydrated();
   // relative times depend on the clock, so nothing renders until hydration
   if (!hydrated) return <span>&nbsp;</span>;
   const expired = new Date(expiresAt).getTime() <= Date.now();
   return (
      <SimpleTooltip label={formatDate(expiresAt)}>
         <span
            tabIndex={0}
            className={expired ? "text-viewertextred" : "text-viewertext"}
         >
            {formatRelativeDay(expiresAt)}
         </span>
      </SimpleTooltip>
   );
};

const SkeletonRows = () =>
   [0, 1].map((row) => (
      <TableRow key={row} className="hover:bg-transparent">
         <TableCell className="px-6">
            <Skeleton className="h-3.5 w-48" />
         </TableCell>
         <TableCell>
            <Skeleton className="h-3.5 w-16" />
         </TableCell>
         <TableCell>
            <Skeleton className="h-3.5 w-24" />
         </TableCell>
         <TableCell>
            <Skeleton className="h-3.5 w-20" />
         </TableCell>
         <TableCell />
      </TableRow>
   ));

const PendingInvites = ({
   serverId,
   invites,
   isLoading,
}: PendingInvitesProps) => {
   const revoke = useRevokeInvite();

   return (
      <Table className="min-w-[736px] table-fixed">
         <TableHeader>
            <TableRow>
               <TableHead className="px-6">Email</TableHead>
               <TableHead className="w-28">Role</TableHead>
               <TableHead className="w-40">Sent by</TableHead>
               <TableHead className="w-36">Expires</TableHead>
               <TableHead className="w-24">
                  <span className="sr-only">Actions</span>
               </TableHead>
            </TableRow>
         </TableHeader>
         <TableBody>
            {isLoading ? (
               <SkeletonRows />
            ) : invites.length === 0 ? (
               <EmptyRow colSpan={COLUMNS} icon={MailOpen}>
                  No pending invites
               </EmptyRow>
            ) : (
               invites.map((invite) => (
                  <TableRow key={invite.id}>
                     <TableCell className="min-w-0 truncate px-6">
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
                              revoke.mutate({ serverId, inviteId: invite.id })
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
   );
};

export default PendingInvites;
