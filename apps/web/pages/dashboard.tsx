import Buckets from "@/components/Home/buckets";
import ServerHeader from "@/components/Home/header";
import ViewerLayout from "@/components/Layout";
import Seo from "@/components/Seo";
import { SITE_PATHS } from "@s3-viewer/types";

const DashboardPage = () => (
   <>
      <Seo
         title="Dashboard"
         description="Browse and manage your S3-compatible storage buckets."
         canonical={SITE_PATHS.dashboard}
         noindex
      />
      <div className="flex size-full min-h-0 flex-col items-center bg-viewerwhite">
         <ServerHeader />
         <Buckets />
      </div>
   </>
);

DashboardPage.getLayout = (page: React.ReactNode) => (
   <ViewerLayout mobileStrategy="fullscreen">{page}</ViewerLayout>
);

export default DashboardPage;
