import Seo from "@/components/seo";
import Hub from "@/components/UseCases/hub";
import { USE_CASES } from "@/components/UseCases/data";
import { pageJsonLd } from "@/lib/jsonld";
import { SITE_URL } from "@/lib/site-config";

const JSON_LD = pageJsonLd({
   type: "CollectionPage",
   name: "S3 Viewer Use Cases",
   path: "/use-cases",
   description:
      "What S3 Viewer is built for: a developer-first dashboard for AWS S3, Cloudflare R2, MinIO, B2, and Wasabi — multi-cloud browsing, team access, sharing without IAM, and a real R2 dashboard.",
   crumbs: "Use cases",
   extra: {
      hasPart: USE_CASES.map((u) => ({
         "@type": "WebPage",
         name: u.title,
         url: `${SITE_URL}/use-cases/${u.slug}`,
         description: u.tagline,
      })),
   },
});

const UseCasesIndex = () => {
   return (
      <>
         <Seo
            title="Use cases"
            description="What developers use S3 Viewer for: a multi-cloud S3 dashboard, a real Cloudflare R2 console, team access without IAM, and a faster S3 browser."
            canonical="/use-cases"
            jsonLd={JSON_LD}
         />
         <Hub />
      </>
   );
};

export default UseCasesIndex;
