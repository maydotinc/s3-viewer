import { Page, PageHeader } from "@/components/Layout/page";
import { SITE_PATHS } from "@s3-viewer/types";
import { TabLink, TabList } from "@s3-viewer/ui/components/tabs";
import Link from "next/link";
import { useRouter } from "next/router";
import type { ReactNode } from "react";

const TABS = [
   { href: SITE_PATHS.settingsProfile, label: "Profile" },
   { href: SITE_PATHS.settingsInvites, label: "Invites" },
] as const;

type SettingsShellProps = {
   action?: ReactNode;
   children: ReactNode;
};

const SettingsShell = ({ action, children }: SettingsShellProps) => {
   const { pathname } = useRouter();
   return (
      <Page>
         <PageHeader title="Settings" actions={action} />
         <nav aria-label="Settings">
            <TabList>
               {TABS.map(({ href, label }) => (
                  <TabLink key={href} active={pathname === href}>
                     <Link href={href}>{label}</Link>
                  </TabLink>
               ))}
            </TabList>
         </nav>
         <div className="flex w-full max-w-3xl min-w-0 flex-col gap-6">
            {children}
         </div>
      </Page>
   );
};

export default SettingsShell;
