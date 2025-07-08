import { BucketProvider } from "@/components/Bucket/Context/context";
import BucketHeader from "@/components/Bucket/header";
import Objects from "@/components/Bucket/objects";
import { GridProvider } from "@/components/DataGrid/context";
import ViewerDashboard from "@/components/Layout/dashboard";
import { useRouter } from "next/router";

const BucketPage = () => {
   const router = useRouter();
   const { slug } = router.query;
   const slugArray = Array.isArray(slug) ? slug : [];
   const bucketName = slugArray[0];
   const path = slugArray.slice(1);

   return (
      <BucketProvider bucketName={bucketName as string} path={path}>
         <GridProvider>
            <div className="flex flex-col size-full">
               <BucketHeader />
               <Objects />
            </div>
         </GridProvider>
      </BucketProvider>
   );
};

BucketPage.getLayout = (page: React.ReactNode) => {
   return <ViewerDashboard mobileStrategy="hidden">{page}</ViewerDashboard>;
};

export default BucketPage;
