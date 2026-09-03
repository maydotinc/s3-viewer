import useSessionStore from "@/lib/stores/sessionStore";
import { SITE_PATHS } from "@s3-viewer/types";
import { useSidebar } from "@s3-viewer/ui/components/sidebar";
import { useRouter } from "next/router";
import { useEffect, useRef } from "react";
import ViewerBanner from "./Banner/banner";
import { ViewerSidebar } from "./sidebar";
import UploadProgressSheet from "./upload-progress";

type ViewerLayoutProps = {
   children: React.ReactNode;
   dashboardOnServerChange?: boolean;
};

/**
 * App shell: banner on top, then a sidebar + main row that fills the rest of
 * the viewport. Pages scroll inside `main`; the body never scrolls.
 */
const ViewerLayout = ({
   children,
   dashboardOnServerChange = true,
}: ViewerLayoutProps) => {
   const serverId = useSessionStore((state) => state.serverId);
   const prevServerId = useRef<string | null>(null);
   const mainRef = useRef<HTMLElement>(null);
   const { openMobile } = useSidebar();
   const { push } = useRouter();

   useEffect(() => {
      const previous = prevServerId.current;
      prevServerId.current = serverId || null;
      if (!dashboardOnServerChange || !previous || !serverId) return;
      if (previous !== serverId) push(SITE_PATHS.dashboard);
   }, [dashboardOnServerChange, push, serverId]);

   // The open drawer owns the screen: nothing behind it takes focus or clicks.
   useEffect(() => {
      const main = mainRef.current;
      if (!main) return;
      main.toggleAttribute("inert", openMobile);
      return () => main.removeAttribute("inert");
   }, [openMobile]);

   return (
      <div className="flex h-dvh w-full flex-col overflow-hidden overscroll-y-none bg-viewerwhite">
         <ViewerBanner />
         <div className="flex min-h-0 flex-1 overflow-hidden">
            <ViewerSidebar />
            <main
               ref={mainRef}
               className="flex min-w-0 flex-1 flex-col overflow-hidden"
            >
               {children}
            </main>
         </div>
         <UploadProgressSheet />
      </div>
   );
};

export default ViewerLayout;
