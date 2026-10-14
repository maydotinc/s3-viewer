import InviteWizard from "@/components/Invites/wizard/invite-wizard";
import { SettingsLayout } from "@/components/Layout";
import Seo from "@/components/seo";
import SettingsShell from "@/components/Settings/shell";
import { SITE_PATHS } from "@s3-viewer/types";
import type { NextPageWithLayout } from "@/pages/_app";

const SettingsInviteNewPage: NextPageWithLayout = () => (
   <>
      <Seo
         title="Invite people"
         description="Invite people to the servers you manage."
         canonical={SITE_PATHS.settingsMembersInvite}
      />
      <SettingsShell>
         <InviteWizard />
      </SettingsShell>
   </>
);

SettingsInviteNewPage.getLayout = (page) => (
   <SettingsLayout>{page}</SettingsLayout>
);

export default SettingsInviteNewPage;
