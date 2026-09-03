import Layout from "@/components/Layout";
import termsData from "@/components/Legal/data/terms";
import LegalLayout from "@/components/Legal/legal-layout";
import Seo from "@/components/Seo";
import { SITE_URL } from "@/lib/site-config";

const TermsPage = () => {
   const jsonLd = {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Terms of Service",
      url: `${SITE_URL}/legal/terms-of-service`,
      isPartOf: {
         "@type": "WebSite",
         name: "S3 Viewer",
         url: SITE_URL,
      },
   };

   return (
      <>
         <Seo
            title="Terms of Service"
            description="Terms of Service for S3 Viewer — the license, acceptable use, and how accounts work. Read before using our open-source S3 object storage viewer."
            canonical="/legal/terms-of-service"
            type="article"
            modifiedTime={new Date(termsData.lastUpdatedIso).toISOString()}
            jsonLd={jsonLd}
         />
         <LegalLayout
            title={termsData.title}
            description={termsData.description}
            eyebrow={termsData.eyebrow}
            effectiveDate={termsData.effectiveDate}
            lastUpdated={termsData.lastUpdated}
            content={termsData.sections}
         />
      </>
   );
};

TermsPage.getLayout = (page: React.ReactNode) => <Layout>{page}</Layout>;

export default TermsPage;
