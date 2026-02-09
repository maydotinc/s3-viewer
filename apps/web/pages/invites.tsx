import Invites from "@/components/Invites";
import ViewerLayout from "@/components/Layout";
import Seo from "@/components/Seo";

const InvitesPage = () => {
   return (
      <>
         <Seo
            title="Invites"
            description="Manage team invites and shared access to your S3 servers."
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
         mobileStrategy="hidden"
         dashboardOnServerChange={false}
      >
         {page}
      </ViewerLayout>
   );
};

export default InvitesPage;
