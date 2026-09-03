import ViewerLayout from "@/components/Layout";
import Seo from "@/components/Seo";
import Share, { sharePath } from "@/components/Share";
import { useRouter } from "next/router";
import type { NextPageWithLayout } from "@/pages/_app";

const SharePage: NextPageWithLayout = () => {
   const { query } = useRouter();
   const serverId = typeof query.serverId === "string" ? query.serverId : "";

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

SharePage.getLayout = (page) => (
   <ViewerLayout dashboardOnServerChange={false}>{page}</ViewerLayout>
);

export default SharePage;
