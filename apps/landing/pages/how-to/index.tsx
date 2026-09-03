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
            "Developer how-to guides for AWS S3, Cloudflare R2, and S3-compatible object storage. Rename, share, filter, upload large files, scope IAM permissions, and delete safely.",
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
            title="How-to guides for S3 and R2"
            description="Developer how-to guides for AWS S3 and Cloudflare R2: rename, share, filter, upload large files, scope IAM permissions, and delete safely."
            canonical="/how-to"
            jsonLd={jsonLd}
         />
         <Hub />
      </>
   );
};

Page.getLayout = (page: React.ReactNode) => <Layout>{page}</Layout>;

export default Page;
