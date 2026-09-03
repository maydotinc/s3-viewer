import { BucketProvider } from "@/components/Buckets/Context";
import BucketHeader from "@/components/Buckets/header";
import ObjectView from "@/components/Buckets/ObjectView";
import Objects from "@/components/Buckets/objects";
import { GridProvider } from "@/components/DataGrid/context";
import ViewerLayout from "@/components/Layout";
import Seo from "@/components/Seo";
import { SITE_PATHS } from "@s3-viewer/types";
import { useRouter } from "next/router";
import { useEffect, useMemo } from "react";

const BucketPage = () => {
   const router = useRouter();
   const { slug, view } = router.query;
   const segments = useMemo(
      () =>
         Array.isArray(slug) ? slug : typeof slug === "string" ? [slug] : [],
      [slug]
   );
   const bucketName = segments[0] ?? "";
   const path = useMemo(() => segments.slice(1), [segments]);

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
         {bucketName && (
            <BucketProvider bucketName={bucketName} path={path}>
               <GridProvider>
                  <div className="flex size-full min-h-0 flex-col">
                     <BucketHeader />
                     {view === "object" && path.length > 0 ? (
                        <ObjectView />
                     ) : (
                        <Objects />
                     )}
                  </div>
               </GridProvider>
            </BucketProvider>
         )}
      </>
   );
};

BucketPage.getLayout = (page: React.ReactNode) => (
   <ViewerLayout mobileStrategy="hidden">{page}</ViewerLayout>
);

export default BucketPage;
