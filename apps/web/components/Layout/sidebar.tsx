import { Card, CardContent, CardHeader, CardTitle } from "@s3-viewer/ui/components/card";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from "@s3-viewer/ui/components/sidebar";
import { House, Star } from "lucide-react";

export function ViewerSidebar() {
  return (
    <Sidebar className="top-[var(--header-height)]">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <House/ > Home
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <Star/ > Starred
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <Card className="py-2">
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