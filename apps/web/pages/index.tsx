import ViewerBanner from "@/components/Layout/Banner/banner";
import Seo from "@/components/Seo";

const HomePage = () => {
   return (
      <div className="flex flex-col size-full">
         <Seo
            title="S3 Viewer"
            description="Connect your S3-compatible storage and manage your buckets and objects."
            canonical="/"
            noindex={true}
         />
         Landing Page
      </div>
   );
};

HomePage.getLayout = (page: React.ReactNode) => {
   return (
      <ViewerBanner>
         {page}
      </ViewerBanner>
   );
}

export default HomePage;