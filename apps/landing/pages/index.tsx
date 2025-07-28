import Layout from "@/components/Layout";

const Home = () => {
   return <div className="text-viewerblue">Landing Page</div>;
};

Home.getLayout = (page: React.ReactNode) => {
   return <Layout>{page}</Layout>;
};

export default Home;
