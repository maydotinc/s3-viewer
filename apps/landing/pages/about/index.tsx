import About from "@/components/About";
import Layout from "@/components/Layout";
import Seo from "@/components/Seo";
import { SITE_URL } from "@/lib/site-config";

const AboutPage = () => {
   const jsonLd = [
      {
         "@context": "https://schema.org",
         "@type": "AboutPage",
         name: "About S3 Viewer",
         url: `${SITE_URL}/about`,
         description:
            "S3 Viewer is built by May Inc. — a small studio shipping fast, open-source tools for object storage.",
      },
      {
         "@context": "https://schema.org",
         "@type": "Organization",
         name: "May Inc.",
         url: "https://may.inc",
         logo: "https://cdn-may.com/assets/may-square-512x512.png",
         description:
            "May Inc. is the studio behind S3 Viewer and other open-source developer tools.",
         sameAs: ["https://github.com/maydotinc", "https://may.inc"],
      },
   ];

   return (
      <>
         <Seo
            title="About S3 Viewer & May Inc."
            description="The story behind S3 Viewer: built by May Inc. as a fast, open-source viewer for any S3-compatible bucket. Meet the team and our values."
            canonical="/about"
            jsonLd={jsonLd}
         />
         <About />
      </>
   );
};

AboutPage.getLayout = (page: React.ReactNode) => <Layout>{page}</Layout>;

export default AboutPage;
