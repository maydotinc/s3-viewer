import Audit from "@/components/Audit";
import { SettingsLayout } from "@/components/Layout";
import Seo from "@/components/seo";
import { useServerIdParam } from "@/lib/hooks/useServerIdParam";
import { auditPath } from "@/lib/server-paths";
import { PRODUCT_NAME } from "@s3-viewer/types";
import type { NextPageWithLayout } from "@/pages/_app";

const AuditPage: NextPageWithLayout = () => {
   const serverId = useServerIdParam();

   return (
      <>
         <Seo
            title="Audit log"
            description={`Every action taken on a server through ${PRODUCT_NAME}.`}
            canonical={serverId ? auditPath(serverId) : ""}
         />
         <Audit serverId={serverId} />
      </>
   );
};

AuditPage.getLayout = (page) => <SettingsLayout>{page}</SettingsLayout>;

export default AuditPage;
