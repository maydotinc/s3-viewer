import Buckets from "@/components/Home/buckets";
import ServerInfo from "@/components/Home/info";
import ViewerDashboard from "@/components/Layout/dashboard";
import { Separator } from "@s3-viewer/ui/components/separator";

const HomePage = () => {
   return (
      <div className="size-full flex flex-col items-center bg-viewerwhite">
         <ServerInfo />
         <Separator className="md:!w-[calc(100%-4rem)]" />
         <Buckets />
      </div>
   );
};

HomePage.getLayout = (page: React.ReactNode) => {
   return <ViewerDashboard mobileStrategy="fullscreen">{page}</ViewerDashboard>;
};

export default HomePage;
