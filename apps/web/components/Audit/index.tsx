import Callout from "@/components/callout";
import BackHeader from "@/components/Layout/back-header";
import { Page } from "@/components/Layout/page";
import ServerPageStatus from "@/components/Layout/server-page-status";
import useBuckets from "@/lib/hooks/queries/s3/useBuckets";
import { useServerPage } from "@/lib/hooks/useServerPage";
import { auditPath } from "@/lib/server-paths";
import { PRODUCT_NAME, type ServerInfo } from "@s3-viewer/types";
import { TabButton, TabList } from "@s3-viewer/ui/components/tabs";
import { useState } from "react";
import Activity from "./activity";
import Settings from "./settings";

const canOpenAudit = (server: ServerInfo) =>
   server.audit.canView || server.audit.canManage;

type Tab = "activity" | "settings";

const AuditTabs = ({
   server,
   bucketsLoading,
}: {
   server: ServerInfo;
   bucketsLoading: boolean;
}) => {
   const [tab, setTab] = useState<Tab>(
      server.audit.canView ? "activity" : "settings"
   );
   const panel =
      tab === "activity" ? (
         <Activity
            serverId={server.id}
            myRole={server.userRole}
            audit={server.audit}
            bucketsLoading={bucketsLoading}
         />
      ) : (
         <Settings serverId={server.id} myRole={server.userRole} />
      );

   if (!(server.audit.canView && server.audit.canManage)) return panel;

   return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
         <TabList>
            <TabButton
               id="audit-tab-activity"
               aria-controls="audit-tabpanel"
               active={tab === "activity"}
               onClick={() => setTab("activity")}
            >
               Activity
            </TabButton>
            <TabButton
               id="audit-tab-settings"
               aria-controls="audit-tabpanel"
               active={tab === "settings"}
               onClick={() => setTab("settings")}
            >
               Settings
            </TabButton>
         </TabList>
         <section
            id="audit-tabpanel"
            role="tabpanel"
            aria-labelledby={`audit-tab-${tab}`}
            className="flex min-h-0 min-w-0 flex-1 flex-col"
         >
            {panel}
         </section>
      </div>
   );
};

const Audit = ({ serverId }: { serverId: string }) => {
   const { server, allowed, isLoading, goBack, bucketsAdopted } = useServerPage(
      { serverId, canOpen: canOpenAudit, pathFor: auditPath }
   );
   const { isBucketsLoading } = useBuckets();

   if (isLoading || !serverId || !server || !allowed)
      return (
         <ServerPageStatus
            loading={isLoading || !serverId}
            denied={
               server && "You don't have access to this server's audit log."
            }
         />
      );

   return (
      <Page>
         <BackHeader
            title="Audit log"
            description={`Every action taken on this server through ${PRODUCT_NAME}.`}
            onBack={goBack}
         />
         <Callout className="shrink-0">
            <p>
               {PRODUCT_NAME} can only record what happens through{" "}
               {PRODUCT_NAME}. Changes made with other access keys, the
               provider&apos;s console or other tools never appear here.
            </p>
         </Callout>
         <AuditTabs
            server={server}
            bucketsLoading={!bucketsAdopted || isBucketsLoading}
         />
      </Page>
   );
};

export default Audit;
