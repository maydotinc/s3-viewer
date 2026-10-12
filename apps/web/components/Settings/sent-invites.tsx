import {
   ActionsCell,
   ExpiresCell,
   InviteListCard,
   RevokeInviteButton,
   RoleCell,
   TextCell,
   type Column,
} from "@/components/invite-table";
import NoEmailNotice from "@/components/no-email-notice";
import { useAllSentInvites } from "@/lib/hooks/queries/server/useInvites";
import useInstanceConfig, {
   emailState,
} from "@/lib/hooks/queries/useInstanceConfig";
import { useUserId } from "@/lib/stores/session-store";
import { Send } from "lucide-react";
import InvitePeople from "./invite-people";

const COLUMNS: readonly Column[] = [
   { label: "Server" },
   { label: "Email" },
   { label: "Role", width: "w-28" },
   { label: "Expires", align: "right", width: "w-32" },
];

const SentInvites = () => {
   const userId = useUserId();
   const query = useAllSentInvites();
   const email = emailState(useInstanceConfig());

   return (
      <InviteListCard
         title="Sent"
         description="Invites you've sent that haven't been accepted yet."
         action={<InvitePeople />}
         notice={
            email === "disabled" && (
               <div className="px-4 pt-4 sm:px-6">
                  <NoEmailNotice />
               </div>
            )
         }
         pending={email === "loading" || !userId}
         query={query}
         errorTitle="Couldn't load sent invites"
         emptyIcon={Send}
         empty="No pending invites"
         columns={COLUMNS}
         actionsWidth="w-24"
         renderRow={(invite) => (
            <>
               <TextCell strong>{invite.server.name}</TextCell>
               <TextCell label="Email">{invite.email}</TextCell>
               <RoleCell
                  role={invite.role}
                  bucketAccess={invite.bucketAccess}
               />
               <ExpiresCell expiresAt={invite.expiresAt} />
               <ActionsCell>
                  <RevokeInviteButton
                     serverId={invite.server.id}
                     inviteId={invite.id}
                     email={invite.email}
                  />
               </ActionsCell>
            </>
         )}
      />
   );
};

export default SentInvites;
