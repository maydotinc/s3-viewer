import LegalHub from "@/components/Legal/legal-hub";
import Seo from "@/components/Seo";
import { pageJsonLd } from "@/lib/jsonld";

const DESCRIPTION =
   "Legal documents for S3 Viewer: Terms of Service and Privacy Policy. Plain-English ground rules for using our open-source S3 object storage viewer.";

const JSON_LD = pageJsonLd({
   type: "CollectionPage",
   name: "S3 Viewer legal documents",
   path: "/legal",
   description: DESCRIPTION,
   crumbs: "Legal",
});

const LegalIndex = () => {
   return (
      <>
         <Seo
            title="Legal"
            description={DESCRIPTION}
            canonical="/legal"
            jsonLd={JSON_LD}
         />
         <LegalHub />
      </>
   );
};

export default LegalIndex;
