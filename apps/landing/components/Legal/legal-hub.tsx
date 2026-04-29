import { ArrowUpRight, ChevronRight, FileText, ShieldCheck } from "lucide-react";
import Link from "next/link";
import privacyPolicyData from "./data/privacy";
import termsOfServiceData from "./data/terms";

type Doc = {
   href: string;
   title: string;
   description: string;
   icon: typeof FileText;
   lastUpdated: string;
};

const DOCS: Doc[] = [
   {
      href: "/legal/terms-of-service",
      title: "Terms of Service",
      description:
         "The ground rules for using S3 Viewer — license, acceptable use, and how we handle accounts and credentials.",
      icon: FileText,
      lastUpdated: termsOfServiceData.lastUpdated,
   },
   {
      href: "/legal/privacy-policy",
      title: "Privacy Policy",
      description:
         "What we collect, how we use it, who sees it, and the rights you have over your data.",
      icon: ShieldCheck,
      lastUpdated: privacyPolicyData.lastUpdated,
   },
];

const LegalHub = () => {
   return (
      <main className="bg-viewerwhite w-full overflow-x-hidden">
         <section className="border-b border-viewerborder bg-viewergray">
            <div className="w-full max-w-screen-xl mx-auto px-5 sm:px-6 md:px-12 lg:px-20 pt-14 md:pt-18 lg:pt-20 pb-12 md:pb-14">
               <nav
                  aria-label="Breadcrumb"
                  className="flex items-center gap-1.5 text-[12px] text-viewerlighttext mb-6"
               >
                  <Link
                     href="/"
                     className="transition-colors hover:text-viewerblack"
                  >
                     Home
                  </Link>
                  <ChevronRight
                     className="size-3"
                     strokeWidth={2.5}
                     aria-hidden
                  />
                  <span className="font-medium text-viewerblack">Legal</span>
               </nav>
               <div className="flex flex-col gap-4 max-w-[760px] motion-fade-up">
                  <h1 className="text-[36px] sm:text-5xl lg:text-[60px] font-semibold tracking-[-0.02em] leading-[1.04] text-viewerblack">
                     Legal documents
                  </h1>
                  <p className="text-[16px] sm:text-[17px] text-viewertext leading-relaxed max-w-[600px]">
                     The plain-English ground rules for using S3 Viewer. We
                     try to keep these short and honest.
                  </p>
               </div>
            </div>
         </section>

         <section>
            <div className="w-full max-w-screen-xl mx-auto px-5 sm:px-6 md:px-12 lg:px-20 py-12 md:py-16 lg:py-20">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 items-stretch">
                  {DOCS.map((doc, i) => (
                     <Link
                        key={doc.href}
                        href={doc.href}
                        aria-label={`Read the ${doc.title}`}
                        className="motion-fade-up group relative flex h-full flex-col gap-4 rounded-2xl border border-viewerborder bg-viewerwhite p-6 sm:p-7 transition-colors duration-300 hover:border-viewerblue/40 focus-visible:outline-none focus-visible:border-viewerblue focus-visible:ring-2 focus-visible:ring-viewerblue/20"
                        style={{ animationDelay: `${i * 80}ms` }}
                     >
                        <div className="flex items-start justify-between gap-3">
                           <span className="grid place-items-center size-10 rounded-[10px] border border-viewerborder bg-viewergray text-viewerblue">
                              <doc.icon className="size-4.5" strokeWidth={1.8} />
                           </span>
                           <span
                              aria-hidden
                              className="flex-none size-8 rounded-full border border-viewerborder bg-viewerwhite grid place-items-center text-viewertext transition-colors duration-200 group-hover:bg-viewerblack group-hover:border-viewerblack group-hover:text-viewerwhite"
                           >
                              <ArrowUpRight
                                 className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                                 strokeWidth={2.25}
                              />
                           </span>
                        </div>

                        <div className="flex flex-col gap-2 mt-auto">
                           <h2 className="text-[20px] sm:text-[22px] font-semibold tracking-tight text-viewerblack leading-snug">
                              {doc.title}
                           </h2>
                           <p className="text-[13.5px] sm:text-[14px] text-viewertext leading-relaxed">
                              {doc.description}
                           </p>
                           <span className="mt-2 text-[11.5px] font-medium text-viewerlighttext">
                              Updated {doc.lastUpdated}
                           </span>
                        </div>
                     </Link>
                  ))}
               </div>

               <p className="mt-10 text-[13px] text-viewerlighttext max-w-[640px]">
                  Questions about any of these policies? Open an issue on our{" "}
                  <Link
                     href="https://github.com/maydotinc/s3-viewer"
                     className="text-viewerblack font-medium underline decoration-viewerborder underline-offset-[3px] hover:decoration-viewerblack"
                  >
                     GitHub repository
                  </Link>
                  .
               </p>
            </div>
         </section>
      </main>
   );
};

export default LegalHub;
