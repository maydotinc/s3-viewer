import Layout from "@/components/Layout";
import DemoBlock from "../components/Landing/demo-block";
import IntroBlock from "../components/Landing/intro-block";
import RepBlock from "../components/Landing/rep-block";
import ToolsBlock from "../components/Landing/tools-block";

const Home = () => {
   return (
      <div className="size-full">
         <IntroBlock />
         <DemoBlock />
         <ToolsBlock />
         <RepBlock />
      </div>
   );
};

Home.getLayout = (page: React.ReactNode) => {
   return <Layout>{page}</Layout>;
};

export default Home;
