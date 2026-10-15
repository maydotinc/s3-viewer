import {
   ActionsCell,
   ExpiresCell,
   InviteListCard,
   RoleCell,
   TextCell,
   type Column,
} from "@/components/invite-table";
import { ConfirmButton } from "@/components/Modals/confirm-button";
import RefreshButton from "@/components/refresh-button";
import useAcceptInvite from "@/lib/hooks/mutations/invites/useAcceptInvite";
import useRejectInvite from "@/lib/hooks/mutations/invites/useRejectInvite";
import { useReceivedInvites } from "@/lib/hooks/queries/server/useInvites";
import { useUserId } from "@/lib/stores/session-store";
import type { ServerInvite } from "@s3-viewer/types";
import { SITE_PATHS } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { MailOpen } from "lucide-react";
import Link from "next/link";

const COLUMNS: readonly Column[] = [
   { label: "Server" },
   { label: "Role", width: "w-28" },
   { label: "Invited by" },
   { label: "Expires", align: "right", width: "w-32" },
];

const InviteActions = ({ invite }: { invite: ServerInvite }) => {
   const accept = useAcceptInvite();
   const reject = useRejectInvite();
   return (
      <ActionsCell>
         <Button
            size="sm"
            loading={accept.isPending}
            disabled={reject.isPending}
            onClick={() => accept.mutate({ inviteId: invite.id })}
         >
            Accept
         </Button>
         <ConfirmButton
            size="sm"
            variant="ghost"
            disabled={accept.isPending}
            confirmTitle="Decline invite"
            confirmDescription={`You won't join ${invite.server.name}. To get access later, ask ${invite.invitedBy.name} to invite you again.`}
            confirmLabel="Decline"
            isPending={reject.isPending}
            onConfirm={(close) =>
               reject.mutate({ inviteId: invite.id }, { onSuccess: close })
            }
         >
            Decline
         </ConfirmButton>
      </ActionsCell>
   );
};

const ReceivedInvites = () => {
   const userId = useUserId();
   const query = useReceivedInvites();

   return (
      <InviteListCard
         title="Invitations"
         description={
            <>
               Servers other people have invited you to. To invite people to
               your own servers, go to{" "}
               <Link
                  href={SITE_PATHS.settingsMembers}
                  className="font-medium text-viewerblack underline-offset-4 hover:underline"
               >
                  Members
               </Link>
               .
            </>
         }
         action={
            <RefreshButton
               size="icon-sm"
               spinning={query.isFetching && !query.isFetchingNextPage}
               disabled={!userId}
               onClick={() => void query.refetch()}
            />
         }
         pending={!userId}
         query={query}
         errorTitle="Couldn't load your invites"
         emptyIcon={MailOpen}
         empty={
            query.hasNextPage
               ? "Load more to check for older invites"
               : "No invites waiting for you"
         }
         columns={COLUMNS}
         actionsWidth="w-44"
         renderRow={(invite) => (
            <>
               <TextCell strong>{invite.server.name}</TextCell>
               <RoleCell
                  role={invite.role}
                  bucketAccess={invite.bucketAccess}
               />
               <TextCell label="Invited by">{invite.invitedBy.name}</TextCell>
               <ExpiresCell expiresAt={invite.expiresAt} />
               <InviteActions invite={invite} />
            </>
         )}
      />
   );
};

export default ReceivedInvites;
