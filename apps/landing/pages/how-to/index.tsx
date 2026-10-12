import { HOW_TOS } from "@/components/HowTo/data";
import Hub from "@/components/HowTo/hub";
import Seo from "@/components/Seo";
import { aboutThing, pageJsonLd } from "@/lib/jsonld";
import { SITE_URL } from "@/lib/site-config";

const JSON_LD = pageJsonLd({
   type: "CollectionPage",
   name: "S3 Viewer how-to guides",
   path: "/how-to",
   description:
      "Developer how-to guides for AWS S3, Cloudflare R2, and S3-compatible object storage. Rename, share, filter, upload large files, scope IAM permissions, and delete safely.",
   crumbs: "How-to",
   extra: {
      hasPart: HOW_TOS.map((h) => ({
         "@type": "TechArticle",
         headline: h.title,
         url: `${SITE_URL}/how-to/${h.slug}`,
         about: aboutThing(h.keyword),
      })),
   },
});

const Page = () => {
   return (
      <>
         <Seo
            title="How-to guides for S3 and R2"
            description="Developer how-to guides for AWS S3 and Cloudflare R2: rename, share, filter, upload large files, scope IAM permissions, and delete safely."
            canonical="/how-to"
            jsonLd={JSON_LD}
         />
         <Hub />
      </>
   );
};

export default Page;
