import useSessionStore from "@/lib/stores/sessionStore";
import { authClient } from "@s3-viewer/auth/client";
import { useRouter } from "next/router";
import { useEffect, useRef } from "react";
import ViewerBanner from "./Banner/banner";
import { ViewerSidebar } from "./sidebar";
import UploadProgressSheet from "./upload-progress";

type ViewerDashboardProps = {
   children: React.ReactNode;
   mobileStrategy?: "fullscreen" | "hidden";
   dashboardOnServerChange?: boolean;
};

const ViewerDashboard = ({
   children,
   mobileStrategy,
   dashboardOnServerChange = true,
}: ViewerDashboardProps) => {
   const prevServerIdRef = useRef<string | null>(null);
   const { data: session, isPending } = authClient.useSession();
   const isAuthenticated = !isPending && Boolean(session?.user);
   const serverId = useSessionStore((state) => state.serverId);
   const { push } = useRouter();

   useEffect(() => {
      if (!dashboardOnServerChange) return;
      if (!isAuthenticated) return;

      const prevServerId = prevServerIdRef.current;
      prevServerIdRef.current = serverId || null;

      if (prevServerId === null) return;
      if (!serverId || prevServerId === serverId) return;

      push("/dashboard");
   }, [dashboardOnServerChange, isAuthenticated, push, serverId]);

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