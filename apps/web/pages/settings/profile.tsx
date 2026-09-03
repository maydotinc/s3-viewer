import ViewerLayout from "@/components/Layout";
import Seo from "@/components/Seo";
import DangerZoneCard from "@/components/Settings/danger-zone-card";
import ProfileCard from "@/components/Settings/profile-card";
import SettingsShell from "@/components/Settings/shell";
import { SITE_PATHS } from "@s3-viewer/types";
import type { NextPageWithLayout } from "../_app";

const SettingsProfilePage: NextPageWithLayout = () => (
   <>
      <Seo
         title="Profile settings"
         description="Your name, photo and account."
         canonical={SITE_PATHS.settingsProfile}
      />
      <SettingsShell>
         <ProfileCard />
         <DangerZoneCard />
      </SettingsShell>
   </>
);

SettingsProfilePage.getLayout = (page) => (
   <ViewerLayout dashboardOnServerChange={false}>{page}</ViewerLayout>
);

export default SettingsProfilePage;
