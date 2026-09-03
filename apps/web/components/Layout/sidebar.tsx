import {
   Sidebar,
   SidebarContent,
   SidebarGroup,
   SidebarGroupContent,
   useSidebar,
} from "@s3-viewer/ui/components/sidebar";
import { useRouter } from "next/router";
import { useEffect } from "react";
import ServerManagement from "./Sidebar/server-management";

type ViewerSidebarProps = {
   mobileStrategy?: "fullscreen" | "hidden";
};

const ViewerSidebar = ({ mobileStrategy }: ViewerSidebarProps) => {
   const { events } = useRouter();
   const { setOpenMobile } = useSidebar();

   useEffect(() => {
      const close = () => setOpenMobile(false);
      events.on("routeChangeComplete", close);
      return () => events.off("routeChangeComplete", close);
   }, [events, setOpenMobile]);

   return (
      <Sidebar
         className="top-[var(--header-height)] h-[calc(100svh-var(--header-height))] select-none"
         mobileStrategy={mobileStrategy}
      >
         <SidebarContent className="p-2">
            <SidebarGroup className="h-full">
               <SidebarGroupContent className="h-full">
                  <ServerManagement />
               </SidebarGroupContent>
            </SidebarGroup>
         </SidebarContent>
      </Sidebar>
   );
};

export { ViewerSidebar };
