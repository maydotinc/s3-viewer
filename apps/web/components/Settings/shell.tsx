import { Page, PageHeader } from "@/components/Layout/page";
import { SITE_PATHS } from "@s3-viewer/types";
import { FOCUS_RING } from "@s3-viewer/ui/lib/classes";
import { cn } from "@s3-viewer/ui/lib/utils";
import { Mail, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import type { ReactNode } from "react";

const SECTIONS = [
   { href: SITE_PATHS.settingsProfile, label: "Profile", icon: UserRound },
   { href: SITE_PATHS.settingsInvites, label: "Invites", icon: Mail },
] as const;

const SettingsShell = ({ children }: { children: ReactNode }) => {
   const { pathname } = useRouter();
   return (
      <Page>
         <PageHeader title="Settings" />
         <div className="flex min-w-0 shrink-0 flex-col gap-6 lg:flex-row lg:gap-8">
            <nav
               aria-label="Settings"
               className="flex shrink-0 gap-1 overflow-x-auto lg:w-40 lg:flex-col"
            >
               {SECTIONS.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href;
                  return (
                     <Link
                        key={href}
                        href={href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                           "flex h-9 shrink-0 items-center gap-2.5 rounded-lg px-2 text-sm text-viewertext outline-none transition-colors duration-150 hover:bg-viewergray/70",
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
            <div className="flex w-full min-w-0 max-w-3xl flex-col gap-6">
               {children}
            </div>
         </div>
      </Page>
   );
};

export default SettingsShell;
