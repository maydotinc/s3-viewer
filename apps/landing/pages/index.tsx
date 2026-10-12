import {
   DemoBlock,
   EncryptionBlock,
   ExploreBlock,
   IntroBlock,
   TeamLetter,
   ToolsBlock,
} from "@/components/Landing";
import Seo from "@/components/Seo";
import { homeJsonLd } from "@/lib/jsonld";

const DESCRIPTION =
   "Browse, upload, share and manage files in any S3-compatible bucket from a fast web UI. Open source, self-hostable.";

const JSON_LD = homeJsonLd(DESCRIPTION);

const Home = () => {
   return (
      <main className="w-full">
         <Seo
            title="Fast, open-source S3 object storage browser"
            description={DESCRIPTION}
            canonical="/"
            imageAlt="S3 Viewer dashboard showing buckets and objects"
            jsonLd={JSON_LD}
         />
         <IntroBlock />
         <EncryptionBlock />
         <DemoBlock />
         <ToolsBlock />
         <TeamLetter />
         <ExploreBlock />
      </main>
   );
};

export default Home;
