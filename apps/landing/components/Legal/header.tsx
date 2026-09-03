import { Calendar, ChevronRight, RefreshCw } from "lucide-react";
import Link from "next/link";

type LegalHeaderProps = {
   title: string;
   description: string;
   eyebrow?: string;
   effectiveDate?: string;
   lastUpdated?: string;
};

const LegalHeader = ({
   title,
   description,
   eyebrow = "Legal",
   effectiveDate,
   lastUpdated,
}: LegalHeaderProps) => {
   return (
      <section className="w-full border-b border-viewerborder bg-viewergray">
         <div className="w-full max-w-screen-xl mx-auto px-5 sm:px-6 md:px-12 lg:px-20 pt-14 md:pt-18 lg:pt-20 pb-12 md:pb-16 lg:pb-20">
            <nav
               aria-label="Breadcrumb"
               className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] text-viewerlighttext mb-6"
            >
               <Link
                  href="/"
                  className="transition-colors hover:text-viewerblack"
               >
                  Home
               </Link>
               <ChevronRight className="size-3" strokeWidth={2.5} aria-hidden />
               <Link
                  href="/legal"
                  className="transition-colors hover:text-viewerblack"
               >
                  Legal
               </Link>
               <ChevronRight className="size-3" strokeWidth={2.5} aria-hidden />
               <span className="font-medium text-viewerblack">{eyebrow}</span>
            </nav>

            <div className="flex flex-col items-start gap-5 max-w-[820px]">
               <h1 className="text-[30px] sm:text-[44px] lg:text-[56px] font-semibold tracking-[-0.02em] leading-[1.06] text-viewerblack">
                  {title}
               </h1>
               <p className="text-[16px] sm:text-[17px] text-viewertext max-w-[620px] leading-relaxed">
                  {description}
               </p>
               <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12.5px] text-viewerlighttext">
                  {effectiveDate && (
                     <span className="inline-flex items-center gap-1.5">
                        <Calendar
                           className="size-3.5 text-viewerblue"
                           strokeWidth={2.25}
                        />
                        Effective {effectiveDate}
                     </span>
                  )}
                  {lastUpdated && (
                     <span className="inline-flex items-center gap-1.5">
                        <RefreshCw
                           className="size-3.5 text-viewerblue"
                           strokeWidth={2.25}
                        />
                        Last updated {lastUpdated}
                     </span>
                  )}
               </div>
            </div>
         </div>
      </section>
   );
};

export default LegalHeader;
