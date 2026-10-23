import About from "@/components/About";
import Seo from "@/components/seo";
import { aboutJsonLd } from "@/lib/jsonld";
import { MAY_NAME } from "@/lib/site-config";
import { PRODUCT_NAME } from "@s3-viewer/types/constants";

const DESCRIPTION = `The story behind ${PRODUCT_NAME}: built by ${MAY_NAME} as a fast, open-source viewer for any S3-compatible bucket. Meet the team and our values.`;

const JSON_LD = aboutJsonLd(
   `${PRODUCT_NAME} is built by ${MAY_NAME} — a small studio shipping fast, open-source tools for object storage.`
);

const AboutPage = () => {
   return (
      <>
         <Seo
            title={`About ${PRODUCT_NAME} & ${MAY_NAME}`}
            description={DESCRIPTION}
            canonical="/about"
            jsonLd={JSON_LD}
         />
         <About />
      </>
   );
};

export default AboutPage;
