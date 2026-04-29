import Layout from "@/components/Layout";
import Seo from "@/components/Seo";
import Hub from "@/components/UseCases/hub";
import { USE_CASES } from "@/components/UseCases/data";
import { SITE_URL } from "@/lib/site-config";

const UseCasesIndex = () => {
   const jsonLd = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "S3 Viewer Use Cases",
      url: `${SITE_URL}/use-cases`,
      description:
         "Workflows S3 Viewer is built for: Cloudflare R2, multi-cloud teams, backups, media libraries, and data engineering.",
      hasPart: USE_CASES.map((u) => ({
         "@type": "WebPage",
         name: u.title,
         url: `${SITE_URL}/use-cases/${u.slug}`,
         description: u.tagline,
      })),
   };

   return (
      <>
         <Seo
            title="Use Cases — S3 Viewer"
            description="See how teams use S3 Viewer for Cloudflare R2, multi-cloud workflows, backups, media libraries, and data engineering."
            canonical="/use-cases"
            jsonLd={jsonLd}
         />
         <Hub />
      </>
   );
};

UseCasesIndex.getLayout = (page: React.ReactNode) => <Layout>{page}</Layout>;

export default UseCasesIndex;
