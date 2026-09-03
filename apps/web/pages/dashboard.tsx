import Buckets from "@/components/Home/buckets";
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
      <Buckets />
   </>
);

DashboardPage.getLayout = (page: React.ReactNode) => (
   <ViewerLayout>{page}</ViewerLayout>
);

export default DashboardPage;
