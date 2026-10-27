import Callout from "@/components/callout";
import BackHeader from "@/components/Layout/back-header";
import { Page } from "@/components/Layout/page";
import ServerPageStatus from "@/components/Layout/server-page-status";
import { TABLE_PANEL } from "@/components/Layout/table-states";
import useBuckets from "@/lib/hooks/queries/s3/useBuckets";
import { useGoBack } from "@/lib/hooks/useGoBack";
import { useUrlServer } from "@/lib/hooks/useUrlServer";
import { auditPath } from "@/lib/server-paths";
import { PRODUCT_NAME, type ServerInfo } from "@s3-viewer/shared";
import { TabButton, TabList } from "@s3-viewer/ui/components/tabs";
import { useState } from "react";
import Activity from "./activity";
import { ActivitySkeleton } from "./activity-table";
import { ToolbarSkeleton } from "./activity-toolbar";
import Settings from "./settings";

const canOpenAudit = (server: ServerInfo) =>
   server.audit.canView || server.audit.canManage;

type Tab = "activity" | "settings";

const TAB_LABELS: Record<Tab, string> = {
   activity: "Activity",
   settings: "Settings",
};

// without onSelect it stands in for the tabs while the server loads
const AuditTabList = ({
   tab,
   onSelect,
}: {
   tab: Tab;
   onSelect?: (tab: Tab) => void;
}) => (
   <TabList>
      {(Object.keys(TAB_LABELS) as Tab[]).map((id) => (
         <TabButton
            key={id}
            id={`audit-tab-${id}`}
            aria-controls={onSelect && "audit-tabpanel"}
            active={tab === id}
            disabled={!onSelect}
            onClick={() => onSelect?.(id)}
         >
            {TAB_LABELS[id]}
         </TabButton>
      ))}
   </TabList>
);

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
         <AuditTabList tab={tab} onSelect={setTab} />
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
   const { server, allowed, isLoading, adopted } = useUrlServer(serverId, {
      canOpen: canOpenAudit,
      pathFor: auditPath,
   });
   const goBack = useGoBack();
   const { isBucketsLoading } = useBuckets();

   const loading = isLoading || !serverId;

   if (!loading && (!server || !allowed))
      return (
         <ServerPageStatus
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
         {loading || !server ? (
            <div
               className="flex min-h-0 min-w-0 flex-1 flex-col gap-4"
               aria-busy="true"
            >
               {/* owners always get both tabs, and they are the usual readers of the log */}
               <AuditTabList tab="activity" />
               <ToolbarSkeleton />
               <div className={TABLE_PANEL}>
                  <ActivitySkeleton />
               </div>
            </div>
         ) : (
            <AuditTabs
               key={server.id}
               server={server}
               bucketsLoading={!adopted || isBucketsLoading}
            />
         )}
      </Page>
   );
};

export default Audit;
