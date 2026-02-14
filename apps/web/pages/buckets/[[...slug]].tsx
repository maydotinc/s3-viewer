import {
   BucketProvider,
   useBucketContext,
} from "@/components/Buckets/Context";
import BucketHeader from "@/components/Buckets/header";
import Objects from "@/components/Buckets/objects";
import ObjectView from "@/components/Buckets/ObjectView";
import { GridProvider } from "@/components/DataGrid/context";
import ViewerLayout from "@/components/Layout";
import Seo from "@/components/Seo";
import { useRouter } from "next/router";

const BucketContent = ({ view }: { view: string | undefined }) => {
   const { notFound } = useBucketContext();

   if (notFound) return (
      <div className="flex flex-col items-center justify-center size-full">
         <h1 className="text-2xl font-bold">404</h1>
         <p className="text-sm text-viewertext">Bucket not found</p>
      </div>
   )

   return (
      <div className="flex flex-col size-full">
         <BucketHeader />
         {view === "object" ? <ObjectView /> : <Objects />}
      </div>
   );
};

const BucketPage = () => {
   const router = useRouter();
   const { slug, view } = router.query;
   const slugArray = Array.isArray(slug) ? slug : [];
   const bucketName = slugArray[0];
   const path = slugArray.slice(1);
   const pageTitle = bucketName || "Buckets";

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
               <BucketContent view={view as string | undefined} />
            </GridProvider>
         </BucketProvider>
      </>
   );
};

BucketPage.getLayout = (page: React.ReactNode) => {
   return <ViewerLayout mobileStrategy="hidden">{page}</ViewerLayout>;
};

export default BucketPage;
