import { SettingsLayout } from "@/components/Layout";
import Seo from "@/components/seo";
import ReceivedInvites from "@/components/Settings/received-invites";
import SettingsShell from "@/components/Settings/shell";
import { useUserId } from "@/lib/stores/session-store";
import { INVITE_QUERY_PARAM, SITE_PATHS } from "@s3-viewer/shared";
import { useRouter } from "next/router";
import { useEffect } from "react";
import type { NextPageWithLayout } from "@/pages/_app";

const SettingsInvitesPage: NextPageWithLayout = () => {
   const router = useRouter();
   const userId = useUserId();
   // the emailed token only matters for signing up; once signed in it leaves the address bar and history
   useEffect(() => {
      if (!userId || router.query[INVITE_QUERY_PARAM] === undefined) return;
      void router.replace(SITE_PATHS.settingsInvites, undefined, {
         shallow: true,
      });
   }, [router, userId]);
   return (
      <>
         <Seo
            title="Invitations"
            description="Servers other people have invited you to."
            canonical={SITE_PATHS.settingsInvites}
         />
         <SettingsShell>
            <ReceivedInvites />
         </SettingsShell>
      </>
   );
};

SettingsInvitesPage.getLayout = (page) => (
   <SettingsLayout>{page}</SettingsLayout>
);

export default SettingsInvitesPage;
