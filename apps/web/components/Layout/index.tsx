import { SITE_PATHS } from "@s3-viewer/types";
import { useSidebar } from "@s3-viewer/ui/components/sidebar";
import { useRouter } from "next/router";
import { useEffect, useRef } from "react";
import ViewerBanner from "@/components/Layout/Banner/banner";
import { useServerId } from "@/lib/stores/session-scope";
import { ViewerSidebar } from "./sidebar";
import UploadProgressSheet from "./upload-progress";

type ViewerLayoutProps = {
   children: React.ReactNode;
   dashboardOnServerChange?: boolean;
};

const ViewerLayout = ({
   children,
   dashboardOnServerChange = true,
}: ViewerLayoutProps) => {
   const serverId = useServerId();
   const prevServerId = useRef<string | null>(null);
   const mainRef = useRef<HTMLElement>(null);
   const { openMobile } = useSidebar();
   const { push } = useRouter();

   useEffect(() => {
      const previous = prevServerId.current;
      prevServerId.current = serverId || null;
      if (!dashboardOnServerChange || !previous || !serverId) return;
      if (previous !== serverId) void push(SITE_PATHS.dashboard);
   }, [dashboardOnServerChange, push, serverId]);

   useEffect(() => {
      const main = mainRef.current;
      if (!main) return;
      main.toggleAttribute("inert", openMobile);
      return () => main.removeAttribute("inert");
   }, [openMobile]);

   return (
      <div className="flex h-dvh w-full flex-col overflow-hidden overscroll-y-none bg-viewerwhite">
         <a
            href="#main-content"
            onClick={(event) => {
               event.preventDefault();
               mainRef.current?.focus();
            }}
            className="fixed left-3 top-3 z-50 -translate-y-24 rounded-lg border border-viewerborder bg-viewerwhite px-3 py-2 text-sm font-medium text-viewerblack shadow-md outline-none focus-visible:translate-y-0 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-viewerblue"
         >
            Skip to content
         </a>
         <ViewerBanner />
         <div className="flex min-h-0 flex-1 overflow-hidden">
            <ViewerSidebar />
            <main
               ref={mainRef}
               id="main-content"
               tabIndex={-1}
               className="flex min-w-0 flex-1 flex-col overflow-hidden outline-none"
            >
               {children}
            </main>
         </div>
         <UploadProgressSheet />
      </div>
   );
};

const SettingsLayout = ({ children }: { children: React.ReactNode }) => (
   <ViewerLayout dashboardOnServerChange={false}>{children}</ViewerLayout>
);

export { SettingsLayout };
export default ViewerLayout;
