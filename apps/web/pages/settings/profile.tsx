import ViewerLayout from "@/components/Layout";
import Seo from "@/components/Seo";
import DangerZoneCard from "@/components/Settings/danger-zone-card";
import PasswordCard from "@/components/Settings/password-card";
import ProfileCard from "@/components/Settings/profile-card";
import SecurityActivityCard from "@/components/Settings/security-activity-card";
import SessionsCard from "@/components/Settings/sessions-card";
import SettingsShell from "@/components/Settings/shell";
import { SITE_PATHS } from "@s3-viewer/types";
import type { NextPageWithLayout } from "../_app";

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
         <SecurityActivityCard />
         <DangerZoneCard />
      </SettingsShell>
   </>
);

SettingsProfilePage.getLayout = (page) => (
   <ViewerLayout dashboardOnServerChange={false}>{page}</ViewerLayout>
);

export default SettingsProfilePage;
