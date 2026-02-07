import useServers from "@/lib/hooks/queries/server/useServers";
import { authClient } from "@s3-viewer/auth/client";
import { Loader } from "lucide-react";
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
   const { data: session } = authClient.useSession();
   const { servers, isServerListFetching } = useServers();
   const isAuthenticated = session;
   const hidePage =
      !isAuthenticated || (servers.length === 0 && !isServerListFetching);

   let pageMessage = "";
   if (!isAuthenticated) {
      pageMessage = "Please login to view this page";
   } else if (servers.length === 0) {
      pageMessage = "Please connect a server to begin viewing its contents";
   }

   return (
      <ViewerBanner>
         <div className="flex size-full">
            <ViewerSidebar mobileStrategy={mobileStrategy} />
            <div className="flex-1 w-full h-full">
               {hidePage ? (
                  <div className="flex flex-col gap-2 size-full items-center justify-center p-2">
                     <p className="text-viewertext text-center">
                        {pageMessage}
                     </p>
                  </div>
               ) : isServerListFetching ? (
                  <div className="flex flex-col items-center justify-center h-full">
                     <Loader className="size-10 animate-spin text-viewerblue" />
                  </div>
               ) : (
                  <>
                     {children}
                     <UploadProgressSheet />
                  </>
               )}
            </div>
         </div>
      </ViewerBanner>
   );
};

export default ViewerDashboard;
