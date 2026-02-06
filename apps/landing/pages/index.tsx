import {
   DemoBlock,
   EncryptionBlock,
   ExploreBlock,
   IntroBlock,
   TeamLetter,
   ToolsBlock,
} from "@/components/Landing";
import Layout from "@/components/Layout";

const Home = () => {
   return (
      <div className="size-full">
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
