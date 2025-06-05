import { Card, CardContent, CardHeader, CardTitle } from "@s3-viewer/ui/components/card";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu
} from "@s3-viewer/ui/components/sidebar";

export function ViewerSidebar() {
  return (
    <Sidebar className="top-[var(--header-height)]">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>SERVERS</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <Card className="py-2 shadow-none border-viewerborder">
                <CardHeader>
                  <CardTitle>
                    Connected Server
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p>
                    Connected to <span className="font-bold">https://example.com</span>
                  </p>
                </CardContent>
              </Card>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
};