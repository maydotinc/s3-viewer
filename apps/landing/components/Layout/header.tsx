import { ExternalLink } from "@/components/external-link";
import { GitHubMark } from "@/components/social-marks";
import { APP_PATH, GITHUB_URL } from "@/lib/site-config";
import { Button } from "@s3-viewer/ui/components/button";
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

const ICON_BUTTON =
   "grid size-9 shrink-0 cursor-pointer place-items-center rounded-md text-viewerblack outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-viewerblue";

const Header = () => {
   const { pathname } = useRouter();
   const [menuOpen, setMenuOpen] = useState(false);
   const headerRef = useRef<HTMLElement>(null);

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

   const navLinks = (className: (current: boolean) => string) =>
      NAV.map(({ href, label }) => {
         const current = pathname === href || pathname.startsWith(`${href}/`);
         return (
            <Link
               key={href}
               href={href}
               aria-current={current ? "page" : undefined}
               onClick={() => setMenuOpen(false)}
               className={className(current)}
            >
               {label}
            </Link>
         );
      });

   return (
      <header
         ref={headerRef}
         className="sticky top-0 z-50 h-16 w-full flex-none border-b border-viewerborder bg-viewerwhite"
      >
         <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-8">
               <Link
                  href="/"
                  draggable={false}
                  className="flex shrink-0 items-center"
                  aria-label="S3 Viewer home"
               >
                  <Image
                     src="/icons/viewer.svg"
                     alt="S3 Viewer"
                     width={150}
                     height={32}
                     className="h-6 w-[112.5px] shrink-0 select-none sm:h-8 sm:w-37.5"
                     priority
                     draggable={false}
                  />
               </Link>

               <nav
                  aria-label="Primary"
                  className="hidden items-center gap-6 md:flex"
               >
                  {navLinks((current) =>
                     cn(
                        "-my-2 py-2 text-sm font-medium transition-colors",
                        current
                           ? "text-viewerblack"
                           : "text-viewertext hover:text-viewerblack"
                     )
                  )}
               </nav>
            </div>

            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
               <ExternalLink
                  href={GITHUB_URL}
                  aria-label="GitHub"
                  className={ICON_BUTTON}
               >
                  <GitHubMark className="size-5" />
               </ExternalLink>

               <Button asChild className="px-3 sm:px-4">
                  <a href={APP_PATH}>Open app</a>
               </Button>

               <button
                  type="button"
                  aria-label="Menu"
                  aria-expanded={menuOpen}
                  aria-controls="site-menu"
                  onClick={() => setMenuOpen((open) => !open)}
                  className={cn(ICON_BUTTON, "md:hidden")}
               >
                  {menuOpen ? (
                     <X className="size-5" aria-hidden />
                  ) : (
                     <Menu className="size-5" aria-hidden />
                  )}
               </button>
            </div>
         </div>

         <nav
            id="site-menu"
            aria-label="Primary"
            hidden={!menuOpen}
            className="absolute inset-x-0 top-full border-b border-viewerborder bg-viewerwhite shadow-sm md:hidden"
         >
            <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-2 sm:px-6">
               {navLinks((current) =>
                  cn(
                     "-mx-2 rounded-md px-2 py-3 text-sm font-medium transition-colors hover:bg-viewergray",
                     current ? "text-viewerblack" : "text-viewertext"
                  )
               )}
            </div>
         </nav>
      </header>
   );
};

export default Header;
