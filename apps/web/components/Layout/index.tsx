import ViewerBanner from "./Banner/banner";
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
         <div className="flex size-full">
            <ViewerSidebar mobileStrategy={mobileStrategy} />
            {children}
            <UploadProgressSheet />
         </div>
      </ViewerBanner>
   );
};

export default ViewerDashboard;