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
         <div className="mx-auto w-full max-w-6xl px-6 pt-16 pb-16">
            <nav
               aria-label="Breadcrumb"
               className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-viewerlighttext mb-6"
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
               <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-viewerblack">
                  {title}
               </h1>
               <p className="text-viewertext max-w-[620px] leading-relaxed">
                  {description}
               </p>
               <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-viewerlighttext">
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
