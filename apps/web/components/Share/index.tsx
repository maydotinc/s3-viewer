import BackHeader from "@/components/Layout/back-header";
import { Page } from "@/components/Layout/page";
import ServerPageStatus from "@/components/Layout/server-page-status";
import { NO_BUCKETS } from "@/lib/hooks/queries/s3/bucket-query";
import useBuckets from "@/lib/hooks/queries/s3/useBuckets";
import { useSentInvites } from "@/lib/hooks/queries/server/useInvites";
import useMembers from "@/lib/hooks/queries/server/useMembers";
import { useServerPage } from "@/lib/hooks/useServerPage";
import { sharePath } from "@/lib/server-paths";
import { Permission, hasPermission } from "@s3-viewer/permissions";
import type {
   Role,
   S3Bucket,
   ServerInfo,
   ServerInvite,
} from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
import { TabButton, TabList } from "@s3-viewer/ui/components/tabs";
import { UserRoundPlus } from "lucide-react";
import { useState } from "react";
import InviteDialog from "./invite-dialog";
import Members from "./members";
import PendingInvites from "./pending-invites";
import { TABLE_PANEL, TableError } from "@/components/Layout/table-states";

const NO_INVITES: ServerInvite[] = [];

const canOpenShare = (server: ServerInfo) =>
   hasPermission(server.userRole, Permission.MANAGE_MEMBERS);

type Tab = "members" | "invites";

type ShareTabsProps = {
   serverId: string;
   // null while the server loads; both lists fetch in parallel and stay skeletons until then
   myRole: Role | null;
   buckets: S3Bucket[];
   isBucketsLoading: boolean;
};

const ShareTabs = ({
   serverId,
   myRole,
   buckets,
   isBucketsLoading,
}: ShareTabsProps) => {
   const [tab, setTab] = useState<Tab>("members");
   const members = useMembers(serverId);
   const invites = useSentInvites(serverId);
   const inviteList = invites.data ?? NO_INVITES;
   const pending = myRole === null;
   const completeMemberCount =
      pending || members.isLoading || members.error || members.hasNextPage
         ? null
         : members.members.length;
   const inviteCount =
      pending || invites.isLoading || invites.error ? null : inviteList.length;

   const panel =
      tab === "members" ? (
         !pending && members.error && members.members.length === 0 ? (
            <TableError
               title="Couldn't load members"
               retrying={members.isFetching}
               onRetry={() => void members.refetch()}
            >
               {members.error.message}
            </TableError>
         ) : (
            <Members
               serverId={serverId}
               myRole={myRole}
               buckets={buckets}
               isBucketsLoading={isBucketsLoading}
               members={members.members}
               isLoading={members.isLoading}
               pages={members}
            />
         )
      ) : !pending && invites.error ? (
         <TableError
            title="Couldn't load pending invites"
            retrying={invites.isFetching}
            onRetry={() => void invites.refetch()}
         >
            {invites.error.message}
         </TableError>
      ) : (
         <PendingInvites
            serverId={serverId}
            myRole={myRole}
            invites={inviteList}
            isLoading={invites.isLoading}
         />
      );

   return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
         <TabList>
            <TabButton
               id="share-tab-members"
               aria-controls="share-tabpanel"
               active={tab === "members"}
               count={completeMemberCount}
               onClick={() => setTab("members")}
            >
               Members
            </TabButton>
            <TabButton
               id="share-tab-invites"
               aria-controls="share-tabpanel"
               active={tab === "invites"}
               count={inviteCount}
               onClick={() => setTab("invites")}
            >
               Pending invites
            </TabButton>
         </TabList>
         <section
            id="share-tabpanel"
            role="tabpanel"
            aria-labelledby={`share-tab-${tab}`}
            className={TABLE_PANEL}
         >
            {panel}
         </section>
      </div>
   );
};

const Share = ({ serverId }: { serverId: string }) => {
   const { server, allowed, isLoading, goBack, bucketsAdopted } = useServerPage(
      { serverId, canOpen: canOpenShare, pathFor: sharePath }
   );
   const { buckets, isBucketsLoading } = useBuckets();
   const [inviting, setInviting] = useState(false);
   const pending = isLoading || !serverId;

   if (!pending && (!server || !allowed))
      return (
         <ServerPageStatus
            denied={
               server &&
               "You need admin access to invite people to this server."
            }
         />
      );

   // the page shell renders before the server loads so a refresh never passes through a spinner
   const ready = pending ? null : server;
   const bucketProps = {
      buckets: bucketsAdopted ? buckets : NO_BUCKETS,
      isBucketsLoading: !bucketsAdopted || isBucketsLoading,
   };

   return (
      <Page>
         <BackHeader
            title={ready ? `Share ${ready.name}` : null}
            description="Invite people and choose which buckets they can see."
            onBack={goBack}
            actions={
               <Button
                  type="button"
                  disabled={!ready}
                  onClick={() => setInviting(true)}
               >
                  <UserRoundPlus aria-hidden="true" />
                  Invite people
               </Button>
            }
         />
         {inviting && ready && (
            <InviteDialog
               serverId={ready.id}
               myRole={ready.userRole}
               onClose={() => setInviting(false)}
               {...bucketProps}
            />
         )}
         <ShareTabs
            serverId={serverId}
            myRole={ready?.userRole ?? null}
            {...bucketProps}
         />
      </Page>
   );
};

export default Share;
