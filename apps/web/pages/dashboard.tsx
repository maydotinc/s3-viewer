import Buckets from "@/components/Home/buckets";
import ViewerLayout from "@/components/Layout";
import Seo from "@/components/seo";
import { SITE_PATHS } from "@s3-viewer/types";
import type { NextPageWithLayout } from "@/pages/_app";

const DashboardPage: NextPageWithLayout = () => (
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

DashboardPage.getLayout = (page) => <ViewerLayout>{page}</ViewerLayout>;

export default DashboardPage;
