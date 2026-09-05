import { Page, PageHeader } from "@/components/Layout/page";
import { SITE_PATHS } from "@s3-viewer/types";
import { cn } from "@s3-viewer/ui/lib/utils";
import { Mail, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import type { ReactNode } from "react";

const SECTIONS = [
   { href: SITE_PATHS.settingsProfile, label: "Profile", icon: UserRound },
   { href: SITE_PATHS.settingsInvites, label: "Invites", icon: Mail },
] as const;

// settings sections are pages side by side: a nav column on the left (a
// horizontal strip below `md`) and the section's cards in a form-width column
const SettingsShell = ({ children }: { children: ReactNode }) => {
   const { pathname } = useRouter();
   return (
      <Page>
         <PageHeader title="Settings" />
         <div className="flex flex-col gap-6 md:flex-row md:gap-8">
            <nav
               aria-label="Settings"
               className="flex shrink-0 gap-1 overflow-x-auto md:w-48 md:flex-col"
            >
               {SECTIONS.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href;
                  return (
                     <Link
                        key={href}
                        href={href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                           "flex h-9 shrink-0 items-center gap-2.5 rounded-lg px-2 text-sm text-viewertext outline-none transition-colors duration-150 hover:bg-viewergray/70 focus-visible:bg-viewergray/70",
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
