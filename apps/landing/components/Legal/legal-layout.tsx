import LegalContent, { LegalContentItemProps } from "./content";
import LegalHeader from "./header";

type LegalLayoutProps = {
   title: string;
   description: string;
   eyebrow?: string;
   effectiveDate?: string;
   lastUpdated?: string;
   content: LegalContentItemProps[];
};

const LegalLayout = ({
   title,
   description,
   eyebrow,
   effectiveDate,
   lastUpdated,
   content,
}: LegalLayoutProps) => {
   return (
      <main className="w-full overflow-x-clip">
         <LegalHeader
            title={title}
            description={description}
            eyebrow={eyebrow}
            effectiveDate={effectiveDate}
            lastUpdated={lastUpdated}
         />
         <LegalContent content={content} />
      </main>
   );
};

export default LegalLayout;
