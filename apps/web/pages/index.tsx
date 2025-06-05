import ViewerBanner from "@/components/Layout/Banner/banner";

const HomePage = () => {
  return (  
    <div className="flex flex-col size-full">
      Landing Page
    </div>
  );
} 

HomePage.getLayout = (page: React.ReactNode) => {
  return (
    <ViewerBanner>
      {page}
    </ViewerBanner>
  );
}

export default HomePage;