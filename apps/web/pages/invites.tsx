import Invites from "@/components/Invites";
import ViewerLayout from "@/components/Layout";
import Seo from "@/components/Seo";
import { authClient } from "@s3-viewer/auth/client";

const InvitesPage = () => {
   const { data: session } = authClient.useSession();
   const isAuthenticated = !!session;

   return (
      <>
         <Seo
            title={isAuthenticated ? "Invites" : "Login Required - S3 Viewer"}
            description={
               isAuthenticated
                  ? "Manage team invites and shared access to your S3 servers."
                  : "Sign in to manage team invitations and shared access to your cloud storage."
            }
            canonical="/invites"
            noindex={true}
         />
         <Invites />
      </>
   );
};

InvitesPage.getLayout = (page: React.ReactNode) => {
   return (
      <ViewerLayout
         requireServer={false}
         mobileStrategy="hidden"
         dashboardOnServerChange={false}
      >
         {page}
      </ViewerLayout>
   );
};

export default InvitesPage;
