import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu
} from "@s3-viewer/ui/components/sidebar";
import ServerManagement from "./Sidebar/serverManagement";

export function ViewerSidebar() {
  return (
    <Sidebar className="top-[var(--header-height)]">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <ServerManagement />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
};