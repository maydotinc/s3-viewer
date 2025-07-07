import { BucketProvider } from "@/components/Bucket/Context/context";
import BucketHeader from "@/components/Bucket/header";
import Objects from "@/components/Bucket/objects";
import ViewerDashboard from "@/components/Layout/dashboard";
import { useRouter } from "next/router";

const BucketPage = () => {
   const router = useRouter();
   const { bucket } = router.query;

   return (
      <BucketProvider bucketName={bucket as string}>
         <div className="flex flex-col size-full">
            <BucketHeader />
            <Objects bucket={bucket as string} />
         </div>
      </BucketProvider>
   );
};

BucketPage.getLayout = (page: React.ReactNode) => {
   return <ViewerDashboard mobileStrategy="hidden">{page}</ViewerDashboard>;
};

export default BucketPage;
