import { HOW_TOS } from "@/components/HowTo/data";
import Hub from "@/components/HowTo/hub";
import Layout from "@/components/Layout";
import Seo from "@/components/Seo";
import { SITE_URL } from "@/lib/site-config";

const Page = () => {
   const jsonLd = [
      {
         "@context": "https://schema.org",
         "@type": "CollectionPage",
         name: "S3 Viewer how-to guides",
         url: `${SITE_URL}/how-to`,
         description:
            "Step-by-step guides for working with AWS S3, Cloudflare R2, and other S3-compatible object storage.",
         hasPart: HOW_TOS.map((h) => ({
            "@type": "TechArticle",
            headline: h.title,
            url: `${SITE_URL}/how-to/${h.slug}`,
            about: { "@type": "Thing", name: h.keyword },
         })),
      },
      {
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
               name: "How-to",
               item: `${SITE_URL}/how-to`,
            },
         ],
      },
   ];

   return (
      <>
         <Seo
            title="How-to guides — S3 Viewer"
            description="Step-by-step guides for AWS S3, Cloudflare R2, and S3-compatible storage. Covers renaming, sharing, permissions, multipart uploads, and more."
            canonical="/how-to"
            jsonLd={jsonLd}
         />
         <Hub />
      </>
   );
};

Page.getLayout = (page: React.ReactNode) => <Layout>{page}</Layout>;

export default Page;
