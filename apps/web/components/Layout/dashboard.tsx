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
            <div className="flex-1 w-full h-full">
               {children}
               <UploadProgressSheet />
            </div>
         </div>
      </ViewerBanner>
   );
};

export default ViewerDashboard;
