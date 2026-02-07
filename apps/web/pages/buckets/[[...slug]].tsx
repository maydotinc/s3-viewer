import { BucketProvider } from "@/components/Buckets/Context";
import BucketHeader from "@/components/Buckets/header";
import Objects from "@/components/Buckets/objects";
import ObjectView from "@/components/Buckets/ObjectView";
import { GridProvider } from "@/components/DataGrid/context";
import ViewerDashboard from "@/components/Layout/dashboard";
import Seo from "@/components/Seo";
import { useRouter } from "next/router";
import { authClient } from "@s3-viewer/auth/client";

const BucketPage = () => {
   const router = useRouter();
   const { data: session } = authClient.useSession();
   const isAuthenticated = !!session;
   const { slug, view } = router.query;
   const slugArray = Array.isArray(slug) ? slug : [];
   const bucketName = slugArray[0];
   const path = slugArray.slice(1);
   const pageTitle = bucketName
      ? path.length > 0
         ? `${path.join("/")} | ${bucketName}`
         : bucketName
      : "Buckets";

   return (
      <>
         <Seo
            title={isAuthenticated ? pageTitle : "Login Required - S3 Viewer"}
            description={
               isAuthenticated 
                  ? "Browse objects and manage files in your S3 bucket."
                  : "Sign in to access your S3 buckets and manage your cloud storage files."
            }
            canonical={
               bucketName
                  ? "/buckets/" + [bucketName, ...path].join("/")
                  : "/buckets"
            }
            noindex={true}
         />
         <BucketProvider bucketName={bucketName as string} path={path}>
            <GridProvider>
               <div className="flex flex-col size-full">
                  <BucketHeader />
                  {view === "object" ? <ObjectView /> : <Objects />}
               </div>
            </GridProvider>
         </BucketProvider>
      </>
   );
};

BucketPage.getLayout = (page: React.ReactNode) => {
   return <ViewerDashboard mobileStrategy="hidden">{page}</ViewerDashboard>;
};

export default BucketPage;
