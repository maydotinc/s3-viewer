import TeamLetter from "@/components/Landing/team-letter";
import Layout from "@/components/Layout";
import DemoBlock from "../components/Landing/demo-block";
import ExploreBlock from "../components/Landing/explore-block";
import IntroBlock from "../components/Landing/intro-block";
import ToolsBlock from "../components/Landing/tools-block";

const Home = () => {
   return (
      <div className="size-full">
         <IntroBlock />
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
