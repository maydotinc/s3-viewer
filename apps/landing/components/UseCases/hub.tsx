import { ArrowUpRight, ChevronRight } from "lucide-react";
import Link from "next/link";
import { USE_CASES } from "./data";

const Hub = () => {
   return (
      <main className="w-full overflow-x-clip">
         <section className="border-b border-viewerborder bg-viewergray">
            <div className="w-full max-w-screen-xl mx-auto px-5 sm:px-6 md:px-12 lg:px-20 pt-14 md:pt-18 lg:pt-20 pb-12 md:pb-14">
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
                  <ChevronRight
                     className="size-3"
                     strokeWidth={2.5}
                     aria-hidden
                  />
                  <span className="font-medium text-viewerblack">
                     Use Cases
                  </span>
               </nav>

               <div className="flex flex-col gap-5 max-w-[760px] motion-fade-up">
                  <h1 className="text-[30px] sm:text-[44px] lg:text-[56px] font-semibold tracking-[-0.02em] leading-[1.06] text-viewerblack">
                     One viewer.
                     <br />
                     Every S3 workflow.
                  </h1>
                  <p className="text-[16px] sm:text-[17px] text-viewertext leading-relaxed max-w-[600px]">
                     S3 Viewer is a developer-first dashboard for AWS S3,
                     Cloudflare R2, MinIO, Backblaze B2, and Wasabi — built to
                     replace the AWS console for the things you do every day.
                     Pick the workflow that matches yours.
                  </p>
               </div>
            </div>
         </section>

         <section>
            <div className="w-full max-w-screen-xl mx-auto px-5 sm:px-6 md:px-12 lg:px-20 py-12 md:py-16 lg:py-20">
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {USE_CASES.map((u, i) => (
                     <Link
                        key={u.slug}
                        href={`/use-cases/${u.slug}`}
                        className="motion-fade-up group relative flex h-full flex-col gap-4 rounded-2xl border border-viewerborder bg-viewerwhite p-6 sm:p-7 transition-colors duration-200 hover:border-viewerblue/40 focus-visible:outline-none focus-visible:border-viewerblue focus-visible:ring-2 focus-visible:ring-viewerblue/20"
                        style={{ animationDelay: `${i * 70}ms` }}
                     >
                        <div className="flex items-start justify-end">
                           <span
                              aria-hidden
                              className="flex-none size-8 rounded-full border border-viewerborder bg-viewerwhite grid place-items-center text-viewertext transition-colors duration-200 group-hover:bg-viewerblack group-hover:border-viewerblack group-hover:text-viewerwhite"
                           >
                              <ArrowUpRight
                                 className="size-4"
                                 strokeWidth={2.25}
                              />
                           </span>
                        </div>
                        <div className="flex flex-col gap-2 mt-auto">
                           <h2 className="text-[20px] sm:text-[22px] font-semibold tracking-tight text-viewerblack leading-snug">
                              {u.title}
                           </h2>
                           <p className="text-[13.5px] sm:text-[14px] text-viewertext leading-relaxed">
                              {u.tagline}
                           </p>
                        </div>
                     </Link>
                  ))}
               </div>
            </div>
         </section>
      </main>
   );
};

export default Hub;
