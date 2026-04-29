import { ArrowUpRight, ChevronRight } from "lucide-react";
import Link from "next/link";
import { HOW_TOS, type HowToCategory } from "./data";

const CATEGORIES: HowToCategory[] = [
   "Files",
   "Sharing",
   "Multi-cloud",
   "Permissions",
];

const Hub = () => {
   return (
      <main className="w-full overflow-x-clip">
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
                  <span className="font-medium text-viewerblack">How-to</span>
               </nav>

               <div className="flex flex-col gap-5 max-w-[760px] motion-fade-up">
                  <h1 className="text-[36px] sm:text-5xl lg:text-[60px] font-semibold tracking-[-0.02em] leading-[1.04] text-viewerblack">
                     How-to guides for S3.
                  </h1>
                  <p className="text-[16px] sm:text-[17px] text-viewertext leading-relaxed max-w-[600px]">
                     Direct answers to the questions developers Google about
                     AWS S3, Cloudflare R2, and S3-compatible storage. AWS CLI
                     and SDK snippets included; one-click equivalents in S3
                     Viewer where they exist.
                  </p>
               </div>
            </div>
         </section>

         <section>
            <div className="w-full max-w-screen-xl mx-auto px-5 sm:px-6 md:px-12 lg:px-20 py-12 md:py-16 lg:py-20 flex flex-col gap-14">
               {CATEGORIES.map((cat) => {
                  const items = HOW_TOS.filter((h) => h.category === cat);
                  if (items.length === 0) return null;
                  return (
                     <div key={cat} className="flex flex-col gap-5">
                        <div className="flex items-end justify-between gap-4">
                           <h2 className="text-[22px] sm:text-[26px] font-semibold tracking-tight text-viewerblack">
                              {cat}
                           </h2>
                           <span className="text-[12px] text-viewerlighttext">
                              {items.length}{" "}
                              {items.length === 1 ? "guide" : "guides"}
                           </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                           {items.map((h, i) => (
                              <Link
                                 key={h.slug}
                                 href={`/how-to/${h.slug}`}
                                 className="motion-fade-up group flex flex-col gap-3 rounded-2xl border border-viewerborder bg-viewerwhite p-5 sm:p-6 transition-colors hover:border-viewerblue/40"
                                 style={{ animationDelay: `${i * 50}ms` }}
                              >
                                 <div className="flex items-start justify-between gap-3">
                                    <h3 className="text-[16px] sm:text-[17px] font-semibold tracking-tight text-viewerblack leading-snug">
                                       {h.title}
                                    </h3>
                                    <ArrowUpRight
                                       className="size-4 flex-none text-viewerlighttext transition-colors group-hover:text-viewerblack mt-1"
                                       strokeWidth={2}
                                    />
                                 </div>
                                 <p className="text-[13px] text-viewertext leading-relaxed">
                                    {h.tagline}
                                 </p>
                              </Link>
                           ))}
                        </div>
                     </div>
                  );
               })}
            </div>
         </section>
      </main>
   );
};

export default Hub;
