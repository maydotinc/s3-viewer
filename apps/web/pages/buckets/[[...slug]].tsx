import { useRouter } from "next/router";
import { BucketProvider } from "@/components/Buckets/Context";
import { GridProvider } from "@/components/DataGrid/context";
import BucketHeader from "@/components/Buckets/header";
import Objects from "@/components/Buckets/objects";
import ObjectView from "@/components/Buckets/ObjectView";
import ViewerDashboard from "@/components/Layout/dashboard";
import Seo from "@/components/Seo";

const BucketPage = () => {
   const router = useRouter();
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
            title={pageTitle}
            description="Browse objects and manage files in your S3 bucket."
            canonical="/buckets"
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
