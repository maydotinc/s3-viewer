import { BucketProvider } from "@/components/Buckets/Context";
import ObjectView from "@/components/Buckets/ObjectView";
import Objects from "@/components/Buckets/objects";
import BucketUnavailable from "@/components/Buckets/unavailable";
import { GRID_CARD, GridProvider } from "@/components/DataGrid/context";
import ViewerLayout from "@/components/Layout";
import { Page } from "@/components/Layout/page";
import ServerPageStatus from "@/components/Layout/server-page-status";
import Seo from "@/components/seo";
import { useRouteServer } from "@/lib/hooks/useRouteServer";
import { bucketRoute } from "@/lib/utils/s3/paths";
import type { NextPageWithLayout } from "@/pages/_app";
import { SITE_PATHS } from "@s3-viewer/types";
import { useRouter } from "next/router";
import { useEffect, useMemo } from "react";

const BucketPage: NextPageWithLayout = () => {
   const router = useRouter();
   const { serverId, bucketName, path, isObjectView } = useMemo(
      () => bucketRoute(router.query),
      [router.query]
   );
   const { unavailable, error, retry, retrying } = useRouteServer(serverId);

   useEffect(() => {
      if (router.isReady && !bucketName)
         void router.replace(SITE_PATHS.dashboard);
   }, [router, bucketName]);

   return (
      <>
         <Seo
            title={bucketName || "Buckets"}
            description="Browse objects and manage files in your S3 bucket."
            canonical={SITE_PATHS.buckets}
            noindex
         />
         {unavailable ? (
            <ServerPageStatus denied={null} />
         ) : error ? (
            <Page>
               <div className={GRID_CARD}>
                  <BucketUnavailable
                     bucketName={bucketName}
                     error={error}
                     failedAt="buckets"
                     onRetry={retry}
                     retrying={retrying}
                  />
               </div>
            </Page>
         ) : (
            bucketName && (
               <BucketProvider
                  serverId={serverId}
                  bucketName={bucketName}
                  path={path}
               >
                  <GridProvider>
                     {isObjectView && path.length > 0 ? (
                        <ObjectView />
                     ) : (
                        <Objects />
                     )}
                  </GridProvider>
               </BucketProvider>
            )
         )}
      </>
   );
};

BucketPage.getLayout = (page) => <ViewerLayout>{page}</ViewerLayout>;

export default BucketPage;
