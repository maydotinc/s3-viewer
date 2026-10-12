import { SettingsLayout } from "@/components/Layout";
import Seo from "@/components/seo";
import Share from "@/components/Share";
import { useServerIdParam } from "@/lib/hooks/useServerIdParam";
import { sharePath } from "@/lib/server-paths";
import type { NextPageWithLayout } from "@/pages/_app";

const SharePage: NextPageWithLayout = () => {
   const serverId = useServerIdParam();

   return (
      <>
         <Seo
            title="Share"
            description="Invite people to a server and manage who can see which buckets."
            canonical={serverId ? sharePath(serverId) : ""}
         />
         <Share serverId={serverId} />
      </>
   );
};

SharePage.getLayout = (page) => <SettingsLayout>{page}</SettingsLayout>;

export default SharePage;
