import About from "@/components/About";
import Seo from "@/components/Seo";
import { aboutJsonLd } from "@/lib/jsonld";

const JSON_LD = aboutJsonLd(
   "S3 Viewer is built by May Inc. — a small studio shipping fast, open-source tools for object storage."
);

const AboutPage = () => {
   return (
      <>
         <Seo
            title="About S3 Viewer & May Inc."
            description="The story behind S3 Viewer: built by May Inc. as a fast, open-source viewer for any S3-compatible bucket. Meet the team and our values."
            canonical="/about"
            jsonLd={JSON_LD}
         />
         <About />
      </>
   );
};

export default AboutPage;
