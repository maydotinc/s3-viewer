import Layout from "@/components/Layout";
import LegalHub from "@/components/Legal/legal-hub";
import Seo from "@/components/Seo";
import { SITE_URL } from "@/lib/site-config";

const LegalIndex = () => {
   const jsonLd = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
         {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: SITE_URL,
         },
         {
            "@type": "ListItem",
            position: 2,
            name: "Legal",
            item: `${SITE_URL}/legal`,
         },
      ],
   };

   return (
      <>
         <Seo
            title="Legal — S3 Viewer"
            description="Legal documents for S3 Viewer: Terms of Service and Privacy Policy. Plain-English ground rules for using our open-source S3 object storage viewer."
            canonical="/legal"
            jsonLd={jsonLd}
         />
         <LegalHub />
      </>
   );
};

LegalIndex.getLayout = (page: React.ReactNode) => <Layout>{page}</Layout>;

export default LegalIndex;
