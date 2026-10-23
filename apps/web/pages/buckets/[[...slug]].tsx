import { SettingsLayout } from "@/components/Layout";
import useServers from "@/lib/hooks/queries/server/useServers";
import { scopedBucketHref } from "@/lib/utils/s3/paths";
import type { NextPageWithLayout } from "@/pages/_app";
import { SITE_PATHS } from "@s3-viewer/types";
import { useRouter } from "next/router";
import { useEffect } from "react";

// a bucket link that names no server opens on the selected one
const UnscopedBucketPage: NextPageWithLayout = () => {
   const router = useRouter();
   const {
      currentServer,
      servers,
      isLoading,
      isCurrentServerMissing,
      serverError,
      serverListError,
   } = useServers();
   const serverId = currentServer?.id;
   // a missing selection is not a dead end: the session manager picks another server
   const nowhere =
      (!isLoading && servers.length === 0) ||
      Boolean(serverListError) ||
      (Boolean(serverError) && !isCurrentServerMissing);

   useEffect(() => {
      if (!router.isReady) return;
      if (serverId)
         void router.replace(scopedBucketHref(serverId, router.query));
      else if (nowhere) void router.replace(SITE_PATHS.dashboard);
   }, [router, serverId, nowhere]);

   return null;
};

// the session manager may still swap a stale selection, which must not bounce this to the dashboard first
UnscopedBucketPage.getLayout = (page) => (
   <SettingsLayout>{page}</SettingsLayout>
);

export default UnscopedBucketPage;
