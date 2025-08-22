type LegalContentItemProps = {
   title: string;
   content: string;
};

const LegalContentItem = ({ title, content }: LegalContentItemProps) => {
   return (
      <div className="flex flex-col gap-4 items-start">
         <h3 className="text-2xl font-semibold text-viewerblack">{title}</h3>
         <span className="flex flex-col gap-2 text-viewertext">{content}</span>
      </div>
   );
};

const LegalContent = ({ content }: { content: LegalContentItemProps[] }) => {
   return (
      <div className="flex flex-col gap-10 md:px-20 xl:px-40">
         {content.map((item) => (
            <LegalContentItem
               key={item.title}
               title={item.title}
               content={item.content}
            />
         ))}
      </div>
   );
};

export default LegalContent;
export type { LegalContentItemProps };
