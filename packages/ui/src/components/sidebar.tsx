"use client";

import { PanelLeftIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@s3-viewer/ui/components/button";
import { cn } from "@s3-viewer/ui/lib/utils";

const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_KEYBOARD_SHORTCUT = "b";
const SIDEBAR_DESKTOP_QUERY = "(min-width: 48rem)";

function useIsDesktop() {
   const [isDesktop, setIsDesktop] = React.useState(false);

   React.useEffect(() => {
      const query = window.matchMedia(SIDEBAR_DESKTOP_QUERY);
      const update = () => setIsDesktop(query.matches);
      update();
      query.addEventListener("change", update);
      return () => query.removeEventListener("change", update);
   }, []);

   return isDesktop;
}

type SidebarContextProps = {
   state: "expanded" | "collapsed";
   open: boolean;
   setOpen: (open: boolean) => void;
   openMobile: boolean;
   setOpenMobile: (open: boolean) => void;
   isDesktop: boolean;
   toggleSidebar: () => void;
};

const SidebarContext = React.createContext<SidebarContextProps | null>(null);

function useSidebar() {
   const context = React.useContext(SidebarContext);
   if (!context) {
      throw new Error("useSidebar must be used within a SidebarProvider.");
   }

   return context;
}

function SidebarProvider({
   defaultOpen = true,
   open: openProp,
   onOpenChange: setOpenProp,
   className,
   style,
   children,
   ...props
}: React.ComponentProps<"div"> & {
   defaultOpen?: boolean;
   open?: boolean;
   onOpenChange?: (open: boolean) => void;
}) {
   const [_open, _setOpen] = React.useState(defaultOpen);
   const [openMobile, setOpenMobile] = React.useState(false);
   const isDesktop = useIsDesktop();
   const open = openProp ?? _open;

   const setOpen = React.useCallback(
      (value: boolean | ((value: boolean) => boolean)) => {
         const openState = typeof value === "function" ? value(open) : value;
         if (setOpenProp) {
            setOpenProp(openState);
         } else {
            _setOpen(openState);
         }
      },
      [setOpenProp, open]
   );

   const toggleSidebar = React.useCallback(() => {
      if (isDesktop) setOpen((current) => !current);
      else setOpenMobile((current) => !current);
   }, [isDesktop, setOpen]);

   React.useEffect(() => {
      if (isDesktop) setOpenMobile(false);
   }, [isDesktop]);

   React.useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
         if (
            event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
            (event.metaKey || event.ctrlKey)
         ) {
            event.preventDefault();
            toggleSidebar();
         }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
   }, [toggleSidebar]);

   const state = open ? "expanded" : "collapsed";

   const contextValue = React.useMemo<SidebarContextProps>(
      () => ({
         state,
         open,
         setOpen,
         openMobile,
         setOpenMobile,
         isDesktop,
         toggleSidebar,
      }),
      [state, open, setOpen, openMobile, isDesktop, toggleSidebar]
   );

   return (
      <SidebarContext.Provider value={contextValue}>
         <div
            data-slot="sidebar-wrapper"
            style={
               {
                  "--sidebar-width": SIDEBAR_WIDTH,
                  ...style,
               } as React.CSSProperties
            }
            className={cn("flex min-h-svh w-full", className)}
            {...props}
         >
            {children}
         </div>
      </SidebarContext.Provider>
   );
}

function Sidebar({
   side = "left",
   mobileStrategy = "hidden",
   className,
   children,
   ...props
}: React.ComponentProps<"div"> & {
   side?: "left" | "right";
   mobileStrategy?: "fullscreen" | "hidden";
}) {
   const { state, openMobile, setOpenMobile, isDesktop } = useSidebar();
   const isDrawer = mobileStrategy === "hidden" && !isDesktop;
   const isDrawerOpen = isDrawer && openMobile;

   const isOffscreen =
      (isDrawer && !openMobile) || (isDesktop && state === "collapsed");

   React.useEffect(() => {
      if (!isDrawerOpen) return;
      const onKeyDown = (event: KeyboardEvent) => {
         if (event.key === "Escape") setOpenMobile(false);
      };
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
   }, [isDrawerOpen, setOpenMobile]);

   const offscreenX =
      side === "left"
         ? "left-[calc(var(--sidebar-width)*-1)]"
         : "right-[calc(var(--sidebar-width)*-1)]";

   return (
      <div
         className="group peer text-sidebar-foreground"
         data-state={state}
         data-side={side}
         data-slot="sidebar"
      >
         <div
            data-slot="sidebar-gap"
            className={cn(
               "relative bg-transparent transition-[width] duration-200 ease-linear md:w-(--sidebar-width)",
               mobileStrategy === "fullscreen" ? "w-full" : "w-0",
               "md:group-data-[state=collapsed]:w-0"
            )}
         />
         {isDrawerOpen && (
            <button
               type="button"
               aria-label="Close the sidebar"
               onClick={() => setOpenMobile(false)}
               className="fixed inset-0 z-[9] cursor-default bg-viewerblack/40 md:hidden"
            />
         )}
         <div
            data-slot="sidebar-container"
            className={cn(
               "fixed inset-y-0 z-10 flex h-svh w-(--sidebar-width) transition-[left,right] duration-200 ease-linear",
               "group-data-[side=left]:border-r group-data-[side=right]:border-l",
               mobileStrategy === "fullscreen" &&
                  "w-full md:w-(--sidebar-width)",
               side === "left" ? "md:left-0" : "md:right-0",
               mobileStrategy === "fullscreen" || isDrawerOpen
                  ? side === "left"
                     ? "left-0"
                     : "right-0"
                  : offscreenX,
               side === "left"
                  ? "md:group-data-[state=collapsed]:left-[calc(var(--sidebar-width)*-1)]"
                  : "md:group-data-[state=collapsed]:right-[calc(var(--sidebar-width)*-1)]",
               className
            )}
            {...(isOffscreen ? { inert: true, "aria-hidden": true } : {})}
            {...props}
         >
            <div
               data-sidebar="sidebar"
               data-slot="sidebar-inner"
               className="bg-sidebar flex h-full w-full flex-col"
            >
               {children}
            </div>
         </div>
      </div>
   );
}

function SidebarTrigger({
   className,
   onClick,
   ...props
}: React.ComponentProps<typeof Button>) {
   const { toggleSidebar, openMobile, isDesktop, open } = useSidebar();
   const expanded = isDesktop ? open : openMobile;

   return (
      <Button
         data-sidebar="trigger"
         data-slot="sidebar-trigger"
         variant="ghost"
         size="icon"
         aria-expanded={expanded}
         aria-label={expanded ? "Hide the sidebar" : "Show the sidebar"}
         className={className}
         onClick={(event) => {
            onClick?.(event);
            toggleSidebar();
         }}
         {...props}
      >
         <PanelLeftIcon />
      </Button>
   );
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
   return (
      <div
         data-slot="sidebar-content"
         data-sidebar="content"
         className={cn(
            "flex min-h-0 flex-1 flex-col gap-2 overflow-auto",
            className
         )}
         {...props}
      />
   );
}

function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
   return (
      <div
         data-slot="sidebar-group"
         data-sidebar="group"
         className={cn("relative flex w-full min-w-0 flex-col p-2", className)}
         {...props}
      />
   );
}

function SidebarGroupContent({
   className,
   ...props
}: React.ComponentProps<"div">) {
   return (
      <div
         data-slot="sidebar-group-content"
         data-sidebar="group-content"
         className={cn("w-full text-sm", className)}
         {...props}
      />
   );
}

export {
   Sidebar,
   SidebarContent,
   SidebarGroup,
   SidebarGroupContent,
   SidebarProvider,
   SidebarTrigger,
   useSidebar,
};
