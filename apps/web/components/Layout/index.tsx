import useServers from "@/lib/hooks/queries/server/useServers";
import { authClient } from "@s3-viewer/auth/client";
import { Loader } from "lucide-react";
import ViewerBanner from "./Banner/banner";
import { ViewerSidebar } from "./sidebar";
import UploadProgressSheet from "./upload-progress";

type ViewerLayoutProps = {
   children: React.ReactNode;
   mobileStrategy?: "fullscreen" | "hidden";
   requireServer?: boolean;
};

const ViewerLayout = ({
   children,
   mobileStrategy,
   requireServer = true,
}: ViewerLayoutProps) => {
   const { data: session, isPending: isSessionPending } =
      authClient.useSession();
   const { servers, isServerListLoading, isServerListFetching } = useServers();
   const isAuthenticated = !!session?.user;

   const shouldShowAuthLoader = isSessionPending;
   const shouldBlockForAuth = !isAuthenticated && !isSessionPending;

   const shouldShowServerLoader =
      requireServer &&
      isAuthenticated &&
      (isServerListLoading || isServerListFetching);
   const shouldBlockForNoServer =
      requireServer &&
      isAuthenticated &&
      !isServerListLoading &&
      !isServerListFetching &&
      servers.length === 0;

   let pageMessage = "";
   if (shouldBlockForAuth) {
      pageMessage = "Please login to view this page";
   } else if (shouldBlockForNoServer) {
      pageMessage = "Please connect a server to begin viewing its contents";
   }

   return (
      <ViewerBanner>
         <div className="flex size-full">
            <ViewerSidebar mobileStrategy={mobileStrategy} />
            <div className="flex-1 w-full h-full">
               {shouldShowAuthLoader ? (
                  <div className="flex flex-col items-center justify-center h-full">
                     <Loader className="size-10 animate-spin text-viewerblue" />
                  </div>
               ) : shouldBlockForAuth || shouldBlockForNoServer ? (
                  <div className="flex flex-col gap-2 size-full items-center justify-center p-2">
                     <p className="text-viewertext text-center">{pageMessage}</p>
                  </div>
               ) : shouldShowServerLoader ? (
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

export default ViewerLayout;
