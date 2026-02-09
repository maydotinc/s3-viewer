import Buckets from "@/components/Home/buckets";
import ServerHeader from "@/components/Home/header";
import ViewerLayout from "@/components/Layout";
import Seo from "@/components/Seo";

const DashboardPage = () => {
   return (
      <>
         <Seo
            title="Dashboard"
            description="Browse and manage your S3-compatible storage buckets."
            canonical="/dashboard"
            noindex={true}
         />
         <div className="size-full flex flex-col items-center bg-viewerwhite">
            <ServerHeader />
            <Buckets />
         </div>
      </>
   );
};

DashboardPage.getLayout = (page: React.ReactNode) => {
   return <ViewerLayout mobileStrategy="fullscreen">{page}</ViewerLayout>;
};

export default DashboardPage;
