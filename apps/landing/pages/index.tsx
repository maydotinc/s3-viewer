import {
   DemoBlock,
   EncryptionBlock,
   ExploreBlock,
   IntroBlock,
   TeamLetter,
   ToolsBlock,
} from "@/components/Landing";
import Layout from "@/components/Layout";
import Seo from "@/components/Seo";
import { SITE_URL } from "@/lib/site-config";

const Home = () => {
   const jsonLd = [
      {
         "@context": "https://schema.org",
         "@type": "WebApplication",
         name: "S3 Viewer",
         description:
            "Browse, upload, share and manage files in any S3-compatible bucket from a fast web UI. Open source, self-hostable.",
         url: SITE_URL,
         applicationCategory: "DeveloperApplication",
         operatingSystem: "Web",
         codeRepository: "https://github.com/maydotinc/s3-viewer",
         offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
         },
      },
      {
         "@context": "https://schema.org",
         "@type": "Organization",
         name: "S3 Viewer",
         url: SITE_URL,
         logo: `${SITE_URL}/icons/viewer.svg`,
         sameAs: ["https://github.com/maydotinc"],
      },
   ];

   return (
      <div className="size-full">
         <Seo
            title="Fast, open-source S3 object storage browser"
            description="Browse, upload, share and manage files in any S3-compatible bucket from a fast web UI. Open source, self-hostable."
            canonical="/"
            image={`${SITE_URL}/landing/bucketview.png`}
            imageAlt="S3 Viewer dashboard showing buckets and objects"
            jsonLd={jsonLd}
         />
         <IntroBlock />
         <EncryptionBlock />
         <DemoBlock />
         <ToolsBlock />
         <TeamLetter />
         <ExploreBlock />
      </div>
   );
};

Home.getLayout = (page: React.ReactNode) => {
   return <Layout>{page}</Layout>;
};

export default Home;
