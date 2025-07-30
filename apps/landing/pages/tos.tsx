import BasicBlock from "@/components/basic-block";
import Layout from "@/components/Layout";
import TosContent from "@/components/Tos/content";
import TosHeader from "@/components/Tos/header";

const TosPage = () => {
   return (
      <BasicBlock className="gap-30 max-md:gap-15 max-xl:gap-20">
         <TosHeader />
         <TosContent />
      </BasicBlock>
   );
};

TosPage.getLayout = (page: React.ReactNode) => {
   return <Layout>{page}</Layout>;
};

export default TosPage;
