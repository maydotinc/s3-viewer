import {
   Sidebar,
   SidebarContent,
   SidebarGroup,
   SidebarGroupContent,
   SidebarMenu,
} from "@s3-viewer/ui/components/sidebar";
import ServerManagement from "./Sidebar/server-management";

type ViewerSidebarProps = {
   mobileStrategy?: "fullscreen" | "hidden";
};

export function ViewerSidebar({ mobileStrategy }: ViewerSidebarProps) {
   return (
      <Sidebar
         className="top-[var(--header-height)] select-none"
         mobileStrategy={mobileStrategy}
      >
         <SidebarContent className="p-2">
            <SidebarGroup>
               <SidebarGroupContent>
                  <SidebarMenu>
                     <ServerManagement />
                  </SidebarMenu>
               </SidebarGroupContent>
            </SidebarGroup>
         </SidebarContent>
      </Sidebar>
   );
}
