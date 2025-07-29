import Layout from "@/components/Layout";
import IntroBlock from "../components/Landing/intro-block";

const Home = () => {
   return (
      <div className="size-full">
         <IntroBlock />
      </div>
   );
};

Home.getLayout = (page: React.ReactNode) => {
   return <Layout>{page}</Layout>;
};

export default Home;
