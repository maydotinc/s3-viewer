import Header from "@/components/Home/header";
import HomeInfo from "@/components/Home/homeInfo";
import ViewerDashboard from "@/components/Layout/dashboard";
import { Separator } from "@s3-viewer/ui/components/separator";

const HomePage = () => {
  return (  
    <div className="flex flex-col size-full">
      <Header />
      <Separator />
      <HomeInfo />
    </div>
  );
} 

HomePage.getLayout = (page: React.ReactNode) => {
  return (
    <ViewerDashboard>
      {page}
    </ViewerDashboard>
  );
}

export default HomePage;