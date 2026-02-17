import BrandKit from "@/components/BrandKit";
import BasicBlock from "@/components/basic-block";
import Layout from "@/components/Layout";
import Seo from "@/components/Seo";

const BrandKitPage = () => {
   return (
      <BasicBlock className="gap-30 max-md:gap-15 max-xl:gap-20">
         <Seo
            title="S3 Viewer Brand Kit"
            description="Official S3 Viewer brand colors and logos."
            canonical="/brand-kit"
         />
         <BrandKit />
      </BasicBlock>
   );
};

BrandKitPage.getLayout = (page: React.ReactNode) => {
   return <Layout>{page}</Layout>;
};

export default BrandKitPage;
