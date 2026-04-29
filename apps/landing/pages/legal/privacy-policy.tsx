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
            description="How S3 Viewer collects, uses, and protects your information. Your S3 credentials are encrypted at rest and we never store copies of your objects."
            canonical="/legal/privacy-policy"
            type="article"
            modifiedTime={new Date().toISOString()}
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
