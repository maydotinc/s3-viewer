import BrandKit from "@/components/BrandKit";
import Layout from "@/components/Layout";
import Seo from "@/components/Seo";
import { SITE_URL } from "@/lib/site-config";

const BrandKitPage = () => {
   const jsonLd = {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "S3 Viewer Brand Kit",
      url: `${SITE_URL}/brand-kit`,
      description:
         "Official brand assets for S3 Viewer: logos, colors, typography, and voice guidelines.",
   };

   return (
      <>
         <Seo
            title="Brand Kit"
            description="Official S3 Viewer brand assets — logos, colors, typography, and voice guidelines for press, partners, and contributors."
            canonical="/brand-kit"
            jsonLd={jsonLd}
         />
         <BrandKit />
      </>
   );
};

BrandKitPage.getLayout = (page: React.ReactNode) => <Layout>{page}</Layout>;

export default BrandKitPage;
