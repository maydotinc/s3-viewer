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
         className="top-14 h-[calc(100svh-3.5rem)] select-none"
         mobileStrategy={mobileStrategy}
      >
         <SidebarContent className="gap-0 p-3">
            <SidebarGroup className="h-full p-0">
               <SidebarGroupContent className="h-full">
                  <ServerManagement />
               </SidebarGroupContent>
            </SidebarGroup>
         </SidebarContent>
      </Sidebar>
   );
};

export { ViewerSidebar };
