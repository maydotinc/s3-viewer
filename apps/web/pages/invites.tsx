import Invites from "@/components/Invites";
import ViewerLayout from "@/components/Layout";
import Seo from "@/components/Seo";
import { SITE_PATHS } from "@s3-viewer/types";
import type { NextPageWithLayout } from "./_app";

const InvitesPage: NextPageWithLayout = () => (
   <>
      <Seo
         title="Invites"
         description="Server invites you've received and sent."
         canonical={SITE_PATHS.invites}
      />
      <Invites />
   </>
);

InvitesPage.getLayout = (page) => (
   <ViewerLayout mobileStrategy="hidden" dashboardOnServerChange={false}>
      {page}
   </ViewerLayout>
);

export default InvitesPage;
