import { Page, PageHeader } from "@/components/Layout/page";
import type { ReactNode } from "react";
import SettingsNav from "./nav";

type SettingsShellProps = {
   action?: ReactNode;
   children: ReactNode;
};

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
