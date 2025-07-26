import Buckets from "@/components/Home/buckets";
import ServerHeader from "@/components/Home/header";
import ViewerDashboard from "@/components/Layout/dashboard";

const HomePage = () => {
   return (
      <div className="size-full flex flex-col items-center bg-viewerwhite">
         <ServerHeader />
         <Buckets />
      </div>
   );
};

HomePage.getLayout = (page: React.ReactNode) => {
   return <ViewerDashboard mobileStrategy="fullscreen">{page}</ViewerDashboard>;
};

export default HomePage;
