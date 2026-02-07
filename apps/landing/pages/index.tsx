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
            "A fast, open-source S3 object storage viewer. 1-click self-host. Browse, upload, and manage your S3 buckets with ease.",
         url: SITE_URL,
         applicationCategory: "DeveloperApplication",
         operatingSystem: "Web",
         codeRepository: "https://github.com/maydotinc",
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
            title="S3 Viewer – Fast, Open-Source S3 Object Storage Browser"
            description="A fast, open-source S3 viewer with 1-click self-host. Browse buckets, upload files, and manage object storage. T3Chat but for S3 – built for speed."
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
