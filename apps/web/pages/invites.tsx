import Invites from "@/components/Invites";
import ViewerDashboard from "@/components/Layout/dashboard";

const InvitesPage = () => {
   return <Invites />;
};

InvitesPage.getLayout = (page: React.ReactNode) => {
   return <ViewerDashboard mobileStrategy="hidden">{page}</ViewerDashboard>;
};

export default InvitesPage;
