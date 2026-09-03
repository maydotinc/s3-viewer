import useSessionStore from "@/lib/stores/sessionStore";
import { SITE_PATHS } from "@s3-viewer/types";
import { useRouter } from "next/router";
import { useEffect, useRef } from "react";
import ViewerBanner from "./Banner/banner";
import { ViewerSidebar } from "./sidebar";
import UploadProgressSheet from "./upload-progress";

type ViewerLayoutProps = {
   children: React.ReactNode;
   mobileStrategy?: "fullscreen" | "hidden";
   dashboardOnServerChange?: boolean;
};

const ViewerLayout = ({
   children,
   mobileStrategy = "hidden",
   dashboardOnServerChange = true,
}: ViewerLayoutProps) => {
   const serverId = useSessionStore((state) => state.serverId);
   const prevServerId = useRef<string | null>(null);
   const { push } = useRouter();

   useEffect(() => {
      const previous = prevServerId.current;
      prevServerId.current = serverId || null;
      if (!dashboardOnServerChange || !previous || !serverId) return;
      if (previous !== serverId) push(SITE_PATHS.dashboard);
   }, [dashboardOnServerChange, push, serverId]);

   return (
      <ViewerBanner showSidebarToggle={mobileStrategy === "hidden"}>
         <div className="flex size-full">
            <ViewerSidebar mobileStrategy={mobileStrategy} />
            {children}
            <UploadProgressSheet />
         </div>
      </ViewerBanner>
   );
};

export default ViewerLayout;
