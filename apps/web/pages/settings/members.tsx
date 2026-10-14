import { SettingsLayout } from "@/components/Layout";
import MembersSettings from "@/components/Members";
import Seo from "@/components/seo";
import SettingsShell from "@/components/Settings/shell";
import type { NextPageWithLayout } from "@/pages/_app";
import { SITE_PATHS } from "@s3-viewer/types";

const SettingsMembersPage: NextPageWithLayout = () => (
   <>
      <Seo
         title="Members"
         description="Manage who has access to your servers."
         canonical={SITE_PATHS.settingsMembers}
      />
      <SettingsShell>
         <MembersSettings />
      </SettingsShell>
   </>
);

SettingsMembersPage.getLayout = (page) => (
   <SettingsLayout>{page}</SettingsLayout>
);

export default SettingsMembersPage;
