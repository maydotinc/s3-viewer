import { PageTitle } from "@/components/basic-block";
import PageHero from "@/components/page-hero";
import { Calendar, RefreshCw } from "lucide-react";

type LegalHeaderProps = {
   title: string;
   description: string;
   effectiveDate: string;
   lastUpdated: string;
};

const LegalHeader = ({
   title,
   description,
   effectiveDate,
   lastUpdated,
}: LegalHeaderProps) => {
   return (
      <PageHero trail={[{ label: "Legal", href: "/legal" }]} current={title}>
         <div className="flex flex-col items-start gap-5 max-w-[820px]">
            <PageTitle>{title}</PageTitle>
            <p className="text-viewertext max-w-[620px] leading-relaxed">
               {description}
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-viewerlighttext">
               <span className="inline-flex items-center gap-1.5">
                  <Calendar
                     className="size-3.5 text-viewerblue"
                     strokeWidth={2.25}
                  />
                  Effective {effectiveDate}
               </span>
               <span className="inline-flex items-center gap-1.5">
                  <RefreshCw
                     className="size-3.5 text-viewerblue"
                     strokeWidth={2.25}
                  />
                  Last updated {lastUpdated}
               </span>
            </div>
         </div>
      </PageHero>
   );
};

export default LegalHeader;
