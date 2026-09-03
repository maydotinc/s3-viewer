import { ApiError } from "@/lib/api";
import useAcceptInvite from "@/lib/hooks/mutations/invites/useAcceptInvite";
import useRejectInvite from "@/lib/hooks/mutations/invites/useRejectInvite";
import { useReceivedInvites } from "@/lib/hooks/queries/server/useInvites";
import { useUserId } from "@/lib/stores/sessionStore";
import { SITE_PATHS } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import Link from "next/link";
import InviteCard, { InviteEmpty, InviteListSkeleton } from "./invite-card";

const ReceivedInvites = () => {
   const userId = useUserId();
   const { data: invites = [], isLoading, error } = useReceivedInvites();
   const accept = useAcceptInvite();
   const reject = useRejectInvite();

   if (!userId || isLoading) return <InviteListSkeleton />;

   if (error instanceof ApiError && error.code === "EMAIL_UNVERIFIED") {
      return (
         <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="max-w-sm text-sm text-viewerlighttext">
               Verify your email to see invitations. Sign in with the code we
               email you to verify it.
            </p>
            <Button asChild variant="outline">
               <Link href={SITE_PATHS.login}>Sign in with email</Link>
            </Button>
         </div>
      );
   }

   if (error) {
      return (
         <p role="alert" className="text-sm text-viewertextred">
            {error.message}
         </p>
      );
   }

   if (invites.length === 0)
      return <InviteEmpty>No invites waiting for you</InviteEmpty>;

   return (
      <ul className="flex flex-col gap-2">
         {invites.map((invite) => {
            const accepting =
               accept.isPending && accept.variables?.inviteId === invite.id;
            const declining =
               reject.isPending && reject.variables?.inviteId === invite.id;
            return (
               <InviteCard
                  key={invite.id}
                  invite={invite}
                  subtitle={`Invited by ${invite.invitedBy.name}`}
                  actions={
                     <>
                        <Button
                           className="flex-1"
                           loading={accepting}
                           disabled={declining}
                           onClick={() =>
                              accept.mutate({ inviteId: invite.id })
                           }
                        >
                           {accepting ? "Accepting…" : "Accept"}
                        </Button>
                        <Button
                           variant="outline"
                           className="flex-1"
                           loading={declining}
                           disabled={accepting}
                           onClick={() =>
                              reject.mutate({ inviteId: invite.id })
                           }
                        >
                           {declining ? "Declining…" : "Decline"}
                        </Button>
                     </>
                  }
               />
            );
         })}
      </ul>
   );
};

export default ReceivedInvites;
