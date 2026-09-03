import Layout from "@/components/Layout";
import privacyData from "@/components/Legal/data/privacy";
import LegalLayout from "@/components/Legal/legal-layout";
import Seo from "@/components/Seo";
import { SITE_URL } from "@/lib/site-config";

const PrivacyPage = () => {
   const jsonLd = {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Privacy Policy",
      url: `${SITE_URL}/legal/privacy-policy`,
      isPartOf: {
         "@type": "WebSite",
         name: "S3 Viewer",
         url: SITE_URL,
      },
   };

   return (
      <>
         <Seo
            title="Privacy Policy"
            description="The S3 Viewer privacy policy — what information we collect, why we collect it, who we share it with, and the rights you have over it."
            canonical="/legal/privacy-policy"
            type="article"
            modifiedTime={new Date(privacyData.lastUpdatedIso).toISOString()}
            jsonLd={jsonLd}
         />
         <LegalLayout
            title={privacyData.title}
            description={privacyData.description}
            eyebrow={privacyData.eyebrow}
            effectiveDate={privacyData.effectiveDate}
            lastUpdated={privacyData.lastUpdated}
            content={privacyData.sections}
         />
      </>
   );
};

PrivacyPage.getLayout = (page: React.ReactNode) => <Layout>{page}</Layout>;

export default PrivacyPage;
