import { GITHUB_URL } from "@/lib/site-config";
import {
   ArrowUpRight,
   ChevronRight,
   FileText,
   ShieldCheck,
} from "lucide-react";
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
         "The ground rules for using S3 Viewer — the license, acceptable use, and how accounts work.",
      icon: FileText,
      lastUpdated: termsOfServiceData.lastUpdated,
   },
   {
      href: "/legal/privacy-policy",
      title: "Privacy Policy",
      description:
         "What information we collect, why we collect it, who we share it with, and the rights you have over it.",
      icon: ShieldCheck,
      lastUpdated: privacyPolicyData.lastUpdated,
   },
];

const LegalHub = () => {
   return (
      <main className="bg-viewerwhite w-full overflow-x-hidden">
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
                  <span className="font-medium text-viewerblack">Legal</span>
               </nav>
               <div className="flex flex-col gap-4 max-w-[760px]">
                  <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-viewerblack">
                     Legal documents
                  </h1>
                  <p className="text-viewertext max-w-[620px]">
                     The plain-English ground rules for using S3 Viewer. We try
                     to keep these short and honest.
                  </p>
               </div>
            </div>
         </section>

         <section>
            <div className="mx-auto w-full max-w-6xl px-6 py-20">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 items-stretch">
                  {DOCS.map((doc) => (
                     <Link
                        key={doc.href}
                        href={doc.href}
                        aria-label={`Read the ${doc.title}`}
                        className="group relative flex h-full flex-col gap-4 rounded-xl border border-viewerborder bg-viewerwhite p-6 transition-colors hover:border-viewerblue/40 outline-none focus-visible:outline-none focus-visible:border-viewerblue"
                     >
                        <div className="flex items-center justify-between gap-3">
                           <span className="grid size-10 place-items-center rounded-lg bg-viewergray text-viewerblue">
                              <doc.icon className="size-5" strokeWidth={1.8} />
                           </span>
                           <ArrowUpRight
                              aria-hidden
                              className="size-4 flex-none text-viewerlighttext transition-colors group-hover:text-viewerblack"
                              strokeWidth={2}
                           />
                        </div>

                        <div className="flex flex-col gap-2 mt-auto">
                           <h2 className="text-xl font-semibold tracking-tight text-viewerblack leading-snug">
                              {doc.title}
                           </h2>
                           <p className="text-sm text-viewertext">
                              {doc.description}
                           </p>
                           <span className="mt-2 text-xs font-medium text-viewerlighttext">
                              Updated {doc.lastUpdated}
                           </span>
                        </div>
                     </Link>
                  ))}
               </div>

               <p className="mt-10 text-xs text-viewerlighttext max-w-[640px]">
                  Questions about any of these policies?{" "}
                  <Link
                     href="/contact"
                     className="text-viewerblack font-medium underline decoration-viewerborder underline-offset-[3px] hover:decoration-viewerblack"
                  >
                     Contact us
                  </Link>{" "}
                  or open an issue on our{" "}
                  <Link
                     href={GITHUB_URL}
                     target="_blank"
                     rel="noreferrer"
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
