import LegalContent, { LegalContentItemProps } from "./content";
import LegalHeader from "./header";

type LegalLayoutProps = {
   title: string;
   description: string;
   content: LegalContentItemProps[];
};

const LegalLayout = ({ title, description, content }: LegalLayoutProps) => {
   return (
      <>
         <LegalHeader title={title} description={description} />
         <LegalContent content={content} />
      </>
   );
};

export default LegalLayout;
