import ViewerLayout from "@/components/Layout";
import Seo from "@/components/Seo";
import InvitePeople from "@/components/Settings/invite-people";
import ReceivedInvites from "@/components/Settings/received-invites";
import SentInvites from "@/components/Settings/sent-invites";
import SettingsShell from "@/components/Settings/shell";
import { SITE_PATHS } from "@s3-viewer/types";
import type { NextPageWithLayout } from "../_app";

const SettingsInvitesPage: NextPageWithLayout = () => (
   <>
      <Seo
         title="Invites"
         description="Server invites you've received and sent."
         canonical={SITE_PATHS.settingsInvites}
      />
      <SettingsShell action={<InvitePeople />}>
         <ReceivedInvites />
         <SentInvites />
      </SettingsShell>
   </>
);

SettingsInvitesPage.getLayout = (page) => (
   <ViewerLayout dashboardOnServerChange={false}>{page}</ViewerLayout>
);

export default SettingsInvitesPage;
