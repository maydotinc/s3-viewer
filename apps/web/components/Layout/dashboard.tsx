import { authClient } from "@s3-viewer/auth/client";
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
   const { data: session, isPending } = authClient.useSession();
   const isAuthenticated = session && !isPending;

   return (
      <ViewerBanner>
         <div className="flex size-full">
            <ViewerSidebar mobileStrategy={mobileStrategy} />
            <div className="flex-1 w-full h-full">
               {isAuthenticated ? (
                  <>
                     {children}
                     <UploadProgressSheet />
                  </>
               ) : (
                  <div className="flex flex-col gap-2 size-full border-none items-center justify-center p-2">
                     <p className="text-viewertext text-center">
                        Please login to view this page
                     </p>
                  </div>
               )}
            </div>
         </div>
      </ViewerBanner>
   );
};

export default ViewerDashboard;
