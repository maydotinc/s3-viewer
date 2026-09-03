import { ArrowUpRight, ChevronRight } from "lucide-react";
import Link from "next/link";
import { USE_CASES } from "./data";

const Hub = () => {
   return (
      <main className="w-full overflow-x-clip">
         <section className="border-b border-viewerborder bg-viewergray">
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
                  <ChevronRight
                     className="size-3"
                     strokeWidth={2.5}
                     aria-hidden
                  />
                  <span className="font-medium text-viewerblack">
                     Use Cases
                  </span>
               </nav>

               <div className="flex flex-col gap-5 max-w-[760px]">
                  <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-viewerblack">
                     One viewer.
                     <br />
                     Every S3 workflow.
                  </h1>
                  <p className="text-viewertext max-w-[600px]">
                     S3 Viewer is a developer-first dashboard for AWS S3,
                     Cloudflare R2, MinIO, Backblaze B2, and Wasabi — built to
                     replace the AWS console for the things you do every day.
                     Pick the workflow that matches yours.
                  </p>
               </div>
            </div>
         </section>

         <section>
            <div className="mx-auto w-full max-w-6xl px-6 py-20">
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {USE_CASES.map((u) => (
                     <Link
                        key={u.slug}
                        href={`/use-cases/${u.slug}`}
                        className="group flex h-full flex-col gap-3 rounded-xl border border-viewerborder bg-viewerwhite p-6 transition-colors outline-none hover:border-viewerblue/40 focus-visible:border-viewerblue focus-visible:outline-none"
                     >
                        <div className="flex items-start justify-between gap-3">
                           <h2 className="text-xl leading-snug font-semibold tracking-tight text-viewerblack">
                              {u.title}
                           </h2>
                           <ArrowUpRight
                              aria-hidden
                              className="mt-1 size-4 flex-none text-viewerlighttext transition-colors group-hover:text-viewerblack"
                              strokeWidth={2}
                           />
                        </div>
                        <p className="text-sm text-viewertext">{u.tagline}</p>
                     </Link>
                  ))}
               </div>
            </div>
         </section>
      </main>
   );
};

export default Hub;
