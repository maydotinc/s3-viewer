import useServers from "@/lib/hooks/queries/server/useServers";
import useSessionStore from "@/lib/stores/sessionStore";
import { authClient } from "@s3-viewer/auth/client";
import { Loader } from "lucide-react";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef } from "react";
import ViewerBanner from "./Banner/banner";
import { ViewerSidebar } from "./sidebar";
import UploadProgressSheet from "./upload-progress";

type ViewerLayoutProps = {
   children: React.ReactNode;
   mobileStrategy?: "fullscreen" | "hidden";
   requireServer?: boolean;
   dashboardOnServerChange?: boolean;
};

const ViewerLayout = ({
   children,
   mobileStrategy,
   requireServer = true,
   dashboardOnServerChange = true,
}: ViewerLayoutProps) => {
   const { push } = useRouter();
   const { data: session, isPending: isSessionPending } =
      authClient.useSession();
   const { servers, isServerListLoading, isServerListFetching } = useServers();
   const { serverId } = useSessionStore();
   const isAuthenticated = !!session?.user;

   const prevServerIdRef = useRef<string | null>(null);

   useEffect(() => {
      if (!dashboardOnServerChange) return;
      if (!isAuthenticated) return;

      const prevServerId = prevServerIdRef.current;
      prevServerIdRef.current = serverId || null;

      if (prevServerId === null) return;
      if (!serverId || prevServerId === serverId) return;

      push("/dashboard");
   }, [dashboardOnServerChange, isAuthenticated, push, serverId]);

   const shouldShowAuthLoader = isSessionPending;
   const shouldBlockForAuth = !isAuthenticated && !isSessionPending;

   const shouldShowServerLoader = useMemo(() => {
      return (
         requireServer &&
         isAuthenticated &&
         (isServerListLoading || isServerListFetching)
      );
   }, [
      requireServer,
      isAuthenticated,
      isServerListLoading,
      isServerListFetching,
   ]);

   const shouldBlockForNoServer = useMemo(() => {
      return (
         requireServer &&
         isAuthenticated &&
         !isServerListLoading &&
         !isServerListFetching &&
         servers.length === 0
      );
   }, [
      requireServer,
      isAuthenticated,
      isServerListLoading,
      isServerListFetching,
      servers.length,
   ]);

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
                     <p className="text-viewertext text-center">
                        {pageMessage}
                     </p>
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
