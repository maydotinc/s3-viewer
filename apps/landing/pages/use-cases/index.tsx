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
         "What S3 Viewer is built for: a developer-first dashboard for AWS S3, Cloudflare R2, MinIO, B2, and Wasabi — multi-cloud browsing, team workspaces, sharing without IAM, and a real R2 dashboard.",
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
            title="Use cases"
            description="What developers use S3 Viewer for: a multi-cloud S3 dashboard, a real Cloudflare R2 console, team access without IAM, and a faster S3 browser."
            canonical="/use-cases"
            jsonLd={jsonLd}
         />
         <Hub />
      </>
   );
};

UseCasesIndex.getLayout = (page: React.ReactNode) => <Layout>{page}</Layout>;

export default UseCasesIndex;
