import { Page, PageHeader } from "@/components/Layout/page";
import type { ReactNode } from "react";
import SettingsNav from "./nav";

type SettingsShellProps = {
   /** Right-aligned header actions. */
   action?: ReactNode;
   children: ReactNode;
};

/**
 * Chrome for every `/settings/*` route: the "Settings" header, a left
 * sub-nav and a content column of cards.
 */
const SettingsShell = ({ action, children }: SettingsShellProps) => (
   <Page>
      <PageHeader title="Settings" actions={action} />
      <div className="flex flex-col gap-6 md:flex-row">
         <SettingsNav />
         <div className="flex w-full max-w-2xl min-w-0 flex-col gap-6">
            {children}
         </div>
      </div>
   </Page>
);

export default SettingsShell;
