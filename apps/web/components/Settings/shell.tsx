import { Page, PageTitle } from "@/components/Layout/page";
import usePrefetchSettings from "@/lib/hooks/queries/usePrefetchSettings";
import { SITE_PATHS } from "@s3-viewer/types";
import { FOCUS_RING } from "@s3-viewer/ui/lib/classes";
import { cn } from "@s3-viewer/ui/lib/utils";
import { MailOpen, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import type { ReactNode } from "react";

const SECTIONS = [
   { href: SITE_PATHS.settingsProfile, label: "Profile", icon: UserRound },
   { href: SITE_PATHS.settingsMembers, label: "Members", icon: Users },
   { href: SITE_PATHS.settingsInvites, label: "Invitations", icon: MailOpen },
] as const;

// nested pages such as /settings/members/invite highlight their section
const isActive = (pathname: string, href: string) =>
   pathname === href || pathname.startsWith(`${href}/`);

const SettingsShell = ({ children }: { children: ReactNode }) => {
   const { pathname } = useRouter();
   const prefetch = usePrefetchSettings();
   // the whole page scrolls, not the card column, so cards run past the window edges instead of clipping in the page padding.
   // the top gap is inside the scroll area, not scroll-container padding: chrome measures the sticky inset from the content box.
   return (
      <Page className="pt-0">
         <div className="flex min-w-0 flex-col gap-6 pt-10 lg:flex-row lg:items-start lg:gap-8">
            <div className="flex min-w-0 shrink-0 flex-col gap-3 lg:sticky lg:top-10 lg:w-40">
               <PageTitle>Settings</PageTitle>
               <nav
                  aria-label="Settings"
                  className="flex gap-1 overflow-x-auto lg:flex-col"
               >
                  {SECTIONS.map(({ href, label, icon: Icon }) => {
                     const active = isActive(pathname, href);
                     return (
                        <Link
                           key={href}
                           href={href}
                           aria-current={active ? "page" : undefined}
                           onPointerEnter={() => prefetch(href)}
                           onFocus={() => prefetch(href)}
                           className={cn(
                              "flex h-9 shrink-0 items-center gap-2.5 rounded-lg px-2 pointer-coarse:h-11 text-sm text-viewertext outline-none transition-colors duration-150 hover:bg-viewergray/70",
                              FOCUS_RING,
                              // the nav scrolls on narrow screens, so an outset ring would be clipped.
                              "focus-visible:-outline-offset-2",
                              active &&
                                 "bg-viewergray font-medium text-viewerblack hover:bg-viewergray"
                           )}
                        >
                           <Icon
                              aria-hidden="true"
                              className="size-4 shrink-0 text-viewertext"
                           />
                           {label}
                        </Link>
                     );
                  })}
               </nav>
            </div>
            <div className="flex w-full min-w-0 max-w-3xl flex-col gap-6">
               {children}
            </div>
         </div>
      </Page>
   );
};

export default SettingsShell;
