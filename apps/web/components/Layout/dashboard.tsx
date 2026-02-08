import ViewerBanner from "./Banner/banner";
import Seo from "@/components/Seo";
import { ViewerSidebar } from "./sidebar";
import UploadProgressSheet from "./upload-progress";

type ViewerDashboardProps = {
   children: React.ReactNode;
   mobileStrategy?: "fullscreen" | "hidden";
};

const ViewerDashboard = ({
   children,
   mobileStrategy,
}: ViewerDashboardProps) => {
   return (
      <ViewerBanner>
         <Seo
            title="Dashboard"
            description="Browse and manage your S3-compatible storage buckets."
            canonical="/dashboard"
            noindex={true}
         />
         <div className="flex size-full">
            <ViewerSidebar mobileStrategy={mobileStrategy} />
            {children}
            <UploadProgressSheet />
         </div>
      </ViewerBanner>
   );
};

export default ViewerDashboard;
