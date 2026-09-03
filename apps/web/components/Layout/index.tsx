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

/**
 * App shell: banner on top, then a sidebar + main row that fills the rest of
 * the viewport. Pages scroll inside `main`; the body never scrolls.
 */
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
      <div className="flex h-dvh w-full flex-col overflow-hidden overscroll-y-none bg-viewerwhite">
         <ViewerBanner showSidebarToggle={mobileStrategy === "hidden"} />
         <div className="flex min-h-0 flex-1">
            <ViewerSidebar mobileStrategy={mobileStrategy} />
            <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
               {children}
            </main>
         </div>
         <UploadProgressSheet />
      </div>
   );
};

export default ViewerLayout;
