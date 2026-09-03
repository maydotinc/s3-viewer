import useRevokeInvite from "@/lib/hooks/mutations/invites/useRevokeInvite";
import { useSentInvites } from "@/lib/hooks/queries/server/useInvites";
import { useUserId } from "@/lib/stores/sessionStore";
import { Button } from "@s3-viewer/ui/components/button";
import InviteCard, { InviteEmpty, InviteListSkeleton } from "./invite-card";

const SentInvites = ({ serverId }: { serverId: string }) => {
   const userId = useUserId();
   const { data: invites = [], isLoading, error } = useSentInvites(serverId);
   const revoke = useRevokeInvite();

   if (!userId || isLoading) return <InviteListSkeleton />;
   if (error) {
      return (
         <p role="alert" className="text-sm text-viewertextred">
            {error.message}
         </p>
      );
   }
   if (invites.length === 0)
      return <InviteEmpty>No pending invites</InviteEmpty>;

   return (
      <ul className="flex flex-col gap-2">
         {invites.map((invite) => {
            const revoking =
               revoke.isPending && revoke.variables?.inviteId === invite.id;
            return (
               <InviteCard
                  key={invite.id}
                  invite={invite}
                  subtitle={`Sent to ${invite.email}`}
                  actions={
                     <Button
                        variant="outline"
                        className="flex-1"
                        loading={revoking}
                        onClick={() =>
                           revoke.mutate({ serverId, inviteId: invite.id })
                        }
                     >
                        {revoking ? "Revoking…" : "Revoke"}
                     </Button>
                  }
               />
            );
         })}
      </ul>
   );
};

export default SentInvites;
