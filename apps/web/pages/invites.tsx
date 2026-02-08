import Invites from "@/components/Invites";
import ViewerDashboard from "@/components/Layout/dashboard";
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
   return <ViewerDashboard mobileStrategy="hidden">{page}</ViewerDashboard>;
};

export default InvitesPage;
