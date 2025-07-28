import Layout from "@/components/Layout";
import TosContent from "@/components/Tos/content";
import TosHeader from "@/components/Tos/header";

const TosPage = () => {
   return (
      <div className="size-full px-[120px] py-[60px] gap-[120px] flex flex-col">
         <TosHeader />
         <TosContent />
      </div>
   );
};

TosPage.getLayout = (page: React.ReactNode) => {
   return <Layout>{page}</Layout>;
};

export default TosPage;
