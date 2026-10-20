import { ExternalLink } from "@/components/external-link";
import { GitHubMark } from "@/components/social-marks";
import { APP_PATH, GITHUB_URL } from "@/lib/site-config";
import { Button } from "@s3-viewer/ui/components/button";
import { FOCUS_RING } from "@s3-viewer/ui/lib/classes";
import { cn } from "@s3-viewer/ui/lib/utils";
import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";

const NAV = [
   { href: "/how-to", label: "How-to" },
   { href: "/use-cases", label: "Use cases" },
   { href: "/about", label: "About" },
];

const SCROLL_THRESHOLD = 24;
const MENU_EXIT_MS = 200;

const EASE = "ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";

const ICON_BUTTON = cn(
   "inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-viewerblack transition-colors duration-200 outline-none hover:bg-viewergray",
   FOCUS_RING
);

const useScrolled = () => {
   const [scrolled, setScrolled] = useState(false);

   useEffect(() => {
      const update = () => setScrolled(window.scrollY > SCROLL_THRESHOLD);
      update();
      window.addEventListener("scroll", update, { passive: true });
      return () => window.removeEventListener("scroll", update);
   }, []);

   return scrolled;
};

// keeps the menu mounted for its exit animation after `open` flips to false.
const useMounted = (open: boolean) => {
   const [mounted, setMounted] = useState(open);

   useEffect(() => {
      if (open) {
         setMounted(true);
         return;
      }
      const id = window.setTimeout(() => setMounted(false), MENU_EXIT_MS);
      return () => window.clearTimeout(id);
   }, [open]);

   return mounted;
};

const isCurrent = (pathname: string, href: string) =>
   pathname === href || pathname.startsWith(`${href}/`);

const GitHubLink = () => (
   <ExternalLink href={GITHUB_URL} aria-label="GitHub" className={ICON_BUTTON}>
      <GitHubMark className="size-5" />
   </ExternalLink>
);

const OpenAppButton = ({ className }: { className?: string }) => (
   <Button asChild className={cn("h-11 rounded-full px-5", className)}>
      <a href={APP_PATH}>Open app</a>
   </Button>
);

const NavLinks = ({ pathname }: { pathname: string }) => (
   <nav
      aria-label="Primary"
      className="absolute left-1/2 hidden -translate-x-1/2 items-center lg:flex"
   >
      {NAV.map(({ href, label }) => {
         const current = isCurrent(pathname, href);
         return (
            <Link
               key={href}
               href={href}
               aria-current={current ? "page" : undefined}
               className={cn(
                  "rounded-full px-3.5 py-2 text-[15px] font-medium whitespace-nowrap transition-colors duration-200 outline-none hover:bg-viewergray",
                  FOCUS_RING,
                  current
                     ? "text-viewerblue"
                     : "text-viewertext hover:text-viewerblack"
               )}
            >
               {label}
            </Link>
         );
      })}
   </nav>
);

const MobileMenu = ({
   open,
   pathname,
   onClose,
}: {
   open: boolean;
   pathname: string;
   onClose: () => void;
}) => {
   const mounted = useMounted(open);
   if (!mounted) return null;

   return (
      <div
         id="site-menu"
         data-state={open ? "open" : "closed"}
         className={cn(
            "pointer-events-auto absolute inset-x-4 top-full mt-2 origin-top rounded-3xl border border-viewerborder bg-viewerwhite/95 p-2 shadow-[0_12px_40px_-16px_rgba(14,18,27,0.25)] backdrop-blur-xl sm:inset-x-8 lg:hidden",
            "data-[state=open]:animate-menu-in data-[state=closed]:animate-menu-out"
         )}
      >
         <nav aria-label="Primary" className="flex flex-col">
            {NAV.map(({ href, label }) => {
               const current = isCurrent(pathname, href);
               return (
                  <Link
                     key={href}
                     href={href}
                     aria-current={current ? "page" : undefined}
                     onClick={onClose}
                     className={cn(
                        "rounded-2xl px-4 py-3 text-[15px] font-medium transition-colors outline-none hover:bg-viewergray",
                        FOCUS_RING,
                        current ? "text-viewerblue" : "text-viewerblack"
                     )}
                  >
                     {label}
                  </Link>
               );
            })}
         </nav>
         <div className="mt-3 pb-1">
            <OpenAppButton className="w-full rounded-2xl" />
         </div>
      </div>
   );
};

const Header = () => {
   const { pathname, asPath } = useRouter();
   const scrolled = useScrolled();
   const [menuOpen, setMenuOpen] = useState(false);
   const headerRef = useRef<HTMLElement>(null);

   useEffect(() => {
      setMenuOpen(false);
   }, [asPath]);

   useEffect(() => {
      if (!menuOpen) return;
      const close = (event: Event) => {
         if (
            event instanceof KeyboardEvent
               ? event.key === "Escape"
               : !headerRef.current?.contains(event.target as Node)
         ) {
            setMenuOpen(false);
         }
      };
      document.addEventListener("keydown", close);
      document.addEventListener("pointerdown", close);
      return () => {
         document.removeEventListener("keydown", close);
         document.removeEventListener("pointerdown", close);
      };
   }, [menuOpen]);

   return (
      <header
         ref={headerRef}
         className="pointer-events-none sticky top-0 z-50 h-22 w-full flex-none"
      >
         <div className="relative px-4 sm:px-8 lg:px-10">
            <div
               className={cn(
                  "pointer-events-auto relative mx-auto flex items-center justify-between border transition-[max-width,height,margin,padding,border-radius,background-color,border-color,box-shadow,backdrop-filter] duration-500",
                  EASE,
                  scrolled
                     ? "mt-5 h-15 max-w-[1040px] rounded-full border-viewerborder bg-viewerwhite/85 pr-2.5 pl-6 shadow-[0_1px_2px_rgba(14,18,27,0.04),0_12px_32px_-12px_rgba(14,18,27,0.18)] backdrop-blur-xl"
                     : "mt-3 h-18 max-w-6xl rounded-none border-transparent bg-transparent pr-2 pl-3 shadow-none"
               )}
            >
               <Link
                  href="/"
                  draggable={false}
                  aria-label="S3 Viewer home"
                  className={cn(
                     "flex shrink-0 origin-left items-center rounded-md transition-transform duration-500 outline-none select-none",
                     EASE,
                     FOCUS_RING,
                     scrolled && "scale-[0.92]"
                  )}
               >
                  <Image
                     src="/icons/viewer.svg"
                     alt="S3 Viewer"
                     width={150}
                     height={32}
                     className="h-6 w-auto sm:h-8"
                     priority
                     draggable={false}
                  />
               </Link>

               <NavLinks pathname={pathname} />

               <div className="flex items-center gap-1 sm:gap-2">
                  <GitHubLink />
                  <OpenAppButton className="hidden lg:inline-flex" />
                  <button
                     type="button"
                     onClick={() => setMenuOpen((open) => !open)}
                     aria-label={menuOpen ? "Close menu" : "Open menu"}
                     aria-expanded={menuOpen}
                     aria-controls="site-menu"
                     className={cn(ICON_BUTTON, "lg:hidden")}
                  >
                     <span
                        key={menuOpen ? "close" : "open"}
                        className="flex animate-icon-in motion-reduce:animate-none"
                     >
                        {menuOpen ? (
                           <X
                              className="size-5.5"
                              strokeWidth={2.25}
                              aria-hidden
                           />
                        ) : (
                           <Menu
                              className="size-5.5"
                              strokeWidth={2.25}
                              aria-hidden
                           />
                        )}
                     </span>
                  </button>
               </div>
            </div>
         </div>

         <MobileMenu
            open={menuOpen}
            pathname={pathname}
            onClose={() => setMenuOpen(false)}
         />
      </header>
   );
};

export default Header;
