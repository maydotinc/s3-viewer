import { useShortcut } from "@/lib/shortcuts";
import { Sidebar, useSidebar } from "@s3-viewer/ui/components/sidebar";
import { useRouter } from "next/router";
import { useEffect } from "react";
import ServerManagement from "./Sidebar/server-management";

/**
 * The sidebar column of the shell. Sizing lives in the primitive (DESIGN.md
 * §2: `w-64 px-4 py-5 gap-6`); this file fills it and owns its shortcut.
 */
const ViewerSidebar = () => {
   const { events } = useRouter();
   const { setOpenMobile, toggleSidebar } = useSidebar();

   useEffect(() => {
      const close = () => setOpenMobile(false);
      events.on("routeChangeComplete", close);
      return () => events.off("routeChangeComplete", close);
   }, [events, setOpenMobile]);

   // The registry fires ⌘B and lists it in the `?` dialog.
   useShortcut({
      keys: "mod b",
      label: "Toggle sidebar",
      group: "Navigation",
      handler: toggleSidebar,
   });

   return (
      <Sidebar className="select-none">
         <div className="flex min-h-0 flex-1 flex-col">
            <ServerManagement />
         </div>
      </Sidebar>
   );
};

export { ViewerSidebar };
