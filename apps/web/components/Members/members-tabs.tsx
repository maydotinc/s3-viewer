import { TABLE_PANEL, TableError } from "@/components/Layout/table-states";
import { useSentInvites } from "@/lib/hooks/queries/server/useInvites";
import useMembers from "@/lib/hooks/queries/server/useMembers";
import {
   MAX_PENDING_INVITES,
   type Role,
   type S3Bucket,
   type ServerInvite,
} from "@s3-viewer/types";
import { TabButton, TabList } from "@s3-viewer/ui/components/tabs";
import { cn } from "@s3-viewer/ui/lib/utils";
import { useRouter } from "next/router";
import { useState } from "react";
import Members from "./members";
import PendingInvites from "./pending-invites";

const NO_INVITES: ServerInvite[] = [];

type Tab = "members" | "invites";

type MembersTabsProps = {
   // empty until a server is selected; both lists stay skeletons until then
   serverId: string;
   // null while the server loads; both lists fetch in parallel and stay skeletons until then
   myRole: Role | null;
   buckets: S3Bucket[];
   isBucketsLoading: boolean;
};

const MembersTabs = ({
   serverId,
   myRole,
   buckets,
   isBucketsLoading,
}: MembersTabsProps) => {
   const { query } = useRouter();
   // the invite wizard lands here on the list it just added to
   const [tab, setTab] = useState<Tab>(
      query.tab === "pending" ? "invites" : "members"
   );
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
         <>
            <PendingInvites
               serverId={serverId}
               myRole={myRole}
               invites={inviteList}
               isLoading={invites.isLoading}
            />
            <p className="sticky left-0 flex h-8 items-center px-4 text-xs text-viewerlighttext tabular-nums">
               {inviteCount === null
                  ? null
                  : `${inviteCount} of ${MAX_PENDING_INVITES} pending invites`}
            </p>
         </>
      );

   return (
      <div className="flex min-w-0 flex-col gap-4">
         <TabList>
            <TabButton
               id="members-tab-members"
               aria-controls="members-tabpanel"
               active={tab === "members"}
               count={completeMemberCount}
               onClick={() => setTab("members")}
            >
               Members
            </TabButton>
            <TabButton
               id="members-tab-invites"
               aria-controls="members-tabpanel"
               active={tab === "invites"}
               count={inviteCount}
               onClick={() => setTab("invites")}
            >
               Pending invites
            </TabButton>
         </TabList>
         <section
            id="members-tabpanel"
            role="tabpanel"
            aria-labelledby={`members-tab-${tab}`}
            // the settings page scrolls as a whole, so the panel holds its own height instead of filling the column
            className={cn(TABLE_PANEL, "min-h-[17rem] flex-none")}
         >
            {panel}
         </section>
      </div>
   );
};

export default MembersTabs;
