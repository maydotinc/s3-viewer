import { SettingsLayout } from "@/components/Layout";
import Seo from "@/components/seo";
import ActivityRecordingCard from "@/components/Settings/activity-recording-card";
import DangerZoneCard from "@/components/Settings/danger-zone-card";
import PasswordCard from "@/components/Settings/password-card";
import ProfileCard from "@/components/Settings/profile-card";
import SessionsCard from "@/components/Settings/sessions-card";
import SettingsShell from "@/components/Settings/shell";
import { SITE_PATHS } from "@s3-viewer/types";
import type { NextPageWithLayout } from "@/pages/_app";

const SettingsProfilePage: NextPageWithLayout = () => (
   <>
      <Seo
         title="Profile settings"
         description="Your name and account."
         canonical={SITE_PATHS.settingsProfile}
      />
      <SettingsShell>
         <ProfileCard />
         <PasswordCard />
         <SessionsCard />
         <ActivityRecordingCard />
         <DangerZoneCard />
      </SettingsShell>
   </>
);

SettingsProfilePage.getLayout = (page) => (
   <SettingsLayout>{page}</SettingsLayout>
);

export default SettingsProfilePage;
