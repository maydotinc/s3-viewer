import Buckets from "@/components/Home/buckets";
import ServerHeader from "@/components/Home/header";
import ViewerDashboard from "@/components/Layout/dashboard";

const DashboardPage = () => {
   return (
      <div className="size-full flex flex-col items-center bg-viewerwhite">
         <ServerHeader />
         <Buckets />
      </div>
   );
};

DashboardPage.getLayout = (page: React.ReactNode) => {
   return <ViewerDashboard mobileStrategy="fullscreen">{page}</ViewerDashboard>;
};

export default DashboardPage;
