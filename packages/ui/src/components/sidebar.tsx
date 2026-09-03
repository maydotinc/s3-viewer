"use client";

import { PanelLeftIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@s3-viewer/ui/components/button";
import { cn } from "@s3-viewer/ui/lib/utils";

const SIDEBAR_DESKTOP_QUERY = "(min-width: 48rem)";

/**
 * DESIGN.md §2: the sidebar is an ordinary 256px flex child of the app shell.
 * No fixed positioning, no `--sidebar-width` dance, no gap element — the only
 * floating variant is the small-screen drawer, which has to sit over content.
 */
const SIDEBAR_BASE =
   "flex w-64 shrink-0 flex-col gap-6 border-r border-viewerborder bg-viewerwhite px-4 py-5";

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
            className={cn("flex min-h-svh w-full", className)}
            {...props}
         >
            {children}
         </div>
      </SidebarContext.Provider>
   );
}

const FOCUSABLE =
   'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function Sidebar({
   className,
   children,
   ...props
}: React.ComponentProps<"aside">) {
   const { state, open, openMobile, setOpenMobile } = useSidebar();
   const ref = React.useRef<HTMLElement>(null);
   // Whatever opened the drawer gets the focus back when it closes.
   const opener = React.useRef<HTMLElement | null>(null);

   React.useEffect(() => {
      const panel = ref.current;
      if (!openMobile || !panel) return;

      opener.current =
         document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
      const focusables = () =>
         Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      (focusables()[0] ?? panel).focus();

      // The drawer covers the page, so the keyboard must stay inside it.
      const onKeyDown = (event: KeyboardEvent) => {
         if (event.key === "Escape") {
            setOpenMobile(false);
            return;
         }
         if (event.key !== "Tab") return;
         const items = focusables();
         const first = items[0];
         const last = items[items.length - 1];
         if (!first || !last) {
            event.preventDefault();
            return;
         }
         const active = document.activeElement;
         if (!event.shiftKey && (active === last || !panel.contains(active))) {
            event.preventDefault();
            first.focus();
         } else if (
            event.shiftKey &&
            (active === first || !panel.contains(active))
         ) {
            event.preventDefault();
            last.focus();
         }
      };

      document.addEventListener("keydown", onKeyDown);
      return () => {
         document.removeEventListener("keydown", onKeyDown);
         opener.current?.focus();
         opener.current = null;
      };
   }, [openMobile, setOpenMobile]);

   return (
      <>
         {openMobile && (
            <button
               type="button"
               aria-label="Close the sidebar"
               onClick={() => setOpenMobile(false)}
               className="fixed inset-0 z-10 cursor-default bg-viewerblack/40 md:hidden"
            />
         )}
         <aside
            ref={ref}
            tabIndex={-1}
            data-slot="sidebar"
            data-state={state}
            className={cn(
               SIDEBAR_BASE,
               // Small screens: a drawer under the 56px top bar. Desktop: an
               // ordinary column, which ⌘B takes out of the row.
               openMobile
                  ? "fixed bottom-0 left-0 top-14 z-20 md:static md:z-auto"
                  : "hidden md:flex",
               !open && "md:hidden",
               className
            )}
            {...props}
         >
            {children}
         </aside>
      </>
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

export { Sidebar, SidebarProvider, SidebarTrigger, useSidebar };
