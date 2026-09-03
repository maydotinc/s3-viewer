import { Button } from "@s3-viewer/ui/components/button";
import { ArrowUpRight, Check, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { FaGithub } from "react-icons/fa";

export type UseCaseFeature = {
   icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
   title: string;
   body: string;
};

export type UseCaseStep = {
   title: string;
   body: string;
};

export type UseCaseFAQ = {
   question: string;
   answer: string;
};

type LinkRef = { href: string; title: string; description: string };

export type UseCasePageProps = {
   eyebrow: string;
   title: string;
   subtitle: string;
   description: string;
   bullets: string[];
   primaryCta?: { href: string; label: string };
   secondaryCta?: { href: string; label: string };
   visual: ReactNode;
   features: UseCaseFeature[];
   steps: UseCaseStep[];
   faqs?: UseCaseFAQ[];
   relatedHowTos?: LinkRef[];
   relatedTitle?: string;
   related: LinkRef[];
};

const UseCasePage = ({
   eyebrow,
   title,
   subtitle,
   description,
   bullets,
   primaryCta = { href: "/dashboard", label: "Open Viewer" },
   secondaryCta = {
      href: "https://github.com/maydotinc/s3-viewer",
      label: "Star on GitHub",
   },
   visual,
   features,
   steps,
   faqs,
   relatedHowTos,
   relatedTitle = "Other use cases",
   related,
}: UseCasePageProps) => {
   return (
      <main className="w-full overflow-x-clip">
         <section className="border-b border-viewerborder bg-viewergray">
            <div className="w-full max-w-screen-xl mx-auto px-5 sm:px-6 md:px-12 lg:px-20 pt-14 md:pt-18 lg:pt-20 pb-14 md:pb-20">
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
                  <Link
                     href="/use-cases"
                     className="transition-colors hover:text-viewerblack"
                  >
                     Use cases
                  </Link>
                  <ChevronRight
                     className="size-3"
                     strokeWidth={2.5}
                     aria-hidden
                  />
                  <span className="font-medium text-viewerblack">
                     {eyebrow}
                  </span>
               </nav>

               <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                  <div className="lg:col-span-7 flex flex-col gap-6">
                     <h1 className="text-[30px] sm:text-[40px] lg:text-[48px] font-semibold tracking-[-0.02em] leading-[1.06] text-viewerblack">
                        {title}
                     </h1>
                     <p className="text-[16px] sm:text-[18px] text-viewertext leading-[1.6] max-w-[600px]">
                        {subtitle}
                     </p>
                     <ul className="flex flex-col gap-2 mt-2">
                        {bullets.map((b) => (
                           <li
                              key={b}
                              className="flex items-start gap-2.5 text-[14.5px] text-viewerblack"
                           >
                              <span className="mt-0.5 grid place-items-center size-4 rounded-full bg-viewerblue/10 text-viewerblue">
                                 <Check className="size-2.5" strokeWidth={3} />
                              </span>
                              {b}
                           </li>
                        ))}
                     </ul>
                     <div className="flex flex-wrap gap-3 mt-2">
                        <Button
                           variant="default"
                           size="lg"
                           className="h-12"
                           asChild
                        >
                           <Link href={primaryCta.href}>
                              {primaryCta.label}
                              <ChevronRight className="size-4" />
                           </Link>
                        </Button>
                        <Link
                           href={secondaryCta.href}
                           target={
                              secondaryCta.href.startsWith("http")
                                 ? "_blank"
                                 : undefined
                           }
                           rel="noreferrer"
                           className="inline-flex h-12 items-center rounded-md border border-viewerborder bg-viewerwhite hover:bg-viewergray transition-colors overflow-hidden"
                        >
                           <span className="flex items-center gap-2 px-4 h-full text-[14px] font-medium text-viewerblack">
                              <FaGithub className="size-4" />
                              {secondaryCta.label}
                           </span>
                        </Link>
                     </div>
                  </div>
                  <div className="lg:col-span-5 w-full">{visual}</div>
               </div>
            </div>
         </section>

         <section>
            <div className="w-full max-w-screen-xl mx-auto px-5 sm:px-6 md:px-12 lg:px-20 py-16 md:py-20">
               <div className="flex flex-col gap-3 mb-10 max-w-[680px]">
                  <span className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-viewerlighttext">
                     Why teams pick S3 Viewer
                  </span>
                  <h2 className="text-[28px] sm:text-[34px] lg:text-[40px] font-semibold tracking-[-0.01em] leading-[1.1] text-viewerblack">
                     {description}
                  </h2>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {features.map((f, i) => (
                     <div
                        key={f.title}
                        className="motion-fade-up flex flex-col gap-3 rounded-2xl border border-viewerborder bg-viewerwhite p-6 hover:border-viewerblue/30 transition-colors"
                        style={{ animationDelay: `${i * 80}ms` }}
                     >
                        <span className="grid place-items-center size-10 rounded-[10px] border border-viewerborder bg-viewergray text-viewerblue">
                           <f.icon className="size-4.5" strokeWidth={1.8} />
                        </span>
                        <h3 className="text-[17px] font-semibold text-viewerblack tracking-tight">
                           {f.title}
                        </h3>
                        <p className="text-[13.5px] text-viewertext leading-[1.65]">
                           {f.body}
                        </p>
                     </div>
                  ))}
               </div>
            </div>
         </section>

         <section className="border-t border-viewerborder bg-viewergray">
            <div className="w-full max-w-screen-xl mx-auto px-5 sm:px-6 md:px-12 lg:px-20 py-16 md:py-20">
               <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                  <div className="lg:col-span-4 flex flex-col gap-3">
                     <span className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-viewerlighttext">
                        How it works
                     </span>
                     <h2 className="text-[28px] sm:text-[34px] font-semibold tracking-[-0.01em] leading-[1.1] text-viewerblack">
                        Three steps to your bucket.
                     </h2>
                     <p className="text-[14.5px] text-viewertext leading-relaxed max-w-[380px]">
                        No agents to install, no infrastructure to manage. Paste
                        credentials and you&apos;re browsing.
                     </p>
                  </div>
                  <ol className="lg:col-span-8 flex flex-col gap-3">
                     {steps.map((step, i) => (
                        <li
                           key={step.title}
                           id={`step-${i + 1}`}
                           className="motion-fade-up flex gap-5 rounded-2xl border border-viewerborder bg-viewerwhite p-5 sm:p-6 scroll-mt-24"
                           style={{ animationDelay: `${i * 80}ms` }}
                        >
                           <span className="flex-none grid place-items-center size-9 rounded-full border border-viewerborder bg-viewergray text-[13px] font-semibold text-viewerblue">
                              {String(i + 1).padStart(2, "0")}
                           </span>
                           <div className="flex flex-col gap-1.5">
                              <h3 className="text-[16px] font-semibold text-viewerblack tracking-tight">
                                 {step.title}
                              </h3>
                              <p className="text-[13.5px] text-viewertext leading-[1.65]">
                                 {step.body}
                              </p>
                           </div>
                        </li>
                     ))}
                  </ol>
               </div>
            </div>
         </section>

         {faqs && faqs.length > 0 && (
            <section className="border-t border-viewerborder">
               <div className="w-full max-w-screen-xl mx-auto px-5 sm:px-6 md:px-12 lg:px-20 py-16 md:py-20">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                     <div className="lg:col-span-4 flex flex-col gap-3">
                        <span className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-viewerlighttext">
                           FAQ
                        </span>
                        <h2 className="text-[28px] sm:text-[34px] font-semibold tracking-[-0.01em] leading-[1.1] text-viewerblack">
                           Common questions.
                        </h2>
                        <p className="text-[14.5px] text-viewertext leading-relaxed max-w-[380px]">
                           Direct answers we wish we&apos;d had when picking a
                           viewer.
                        </p>
                     </div>
                     <div className="lg:col-span-8 divide-y divide-viewerborder rounded-2xl border border-viewerborder bg-viewerwhite">
                        {faqs.map((faq, i) => (
                           <details
                              key={i}
                              className="group p-5 sm:p-6 [&_svg]:open:rotate-90"
                           >
                              <summary className="flex cursor-pointer items-center justify-between gap-4 list-none">
                                 <h3 className="text-[15.5px] sm:text-[16px] font-semibold text-viewerblack tracking-tight pr-2">
                                    {faq.question}
                                 </h3>
                                 <ChevronRight
                                    className="size-4 flex-none text-viewertext transition-transform"
                                    aria-hidden
                                 />
                              </summary>
                              <div className="mt-3 text-[14px] text-viewertext leading-[1.7] pr-4">
                                 {faq.answer}
                              </div>
                           </details>
                        ))}
                     </div>
                  </div>
               </div>
            </section>
         )}

         {relatedHowTos && relatedHowTos.length > 0 && (
            <section className="border-t border-viewerborder bg-viewergray">
               <div className="w-full max-w-screen-xl mx-auto px-5 sm:px-6 md:px-12 lg:px-20 py-16 md:py-20">
                  <div className="flex items-end justify-between gap-6 mb-8">
                     <div className="flex flex-col gap-2">
                        <span className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-viewerlighttext">
                           Related guides
                        </span>
                        <h2 className="text-[24px] sm:text-[30px] font-semibold tracking-tight text-viewerblack">
                           Step-by-step how-tos.
                        </h2>
                     </div>
                     <Link
                        href="/how-to"
                        className="hidden sm:inline-flex items-center gap-1 text-[13.5px] font-medium text-viewerblue hover:underline"
                     >
                        All guides
                        <ArrowUpRight className="size-3.5" />
                     </Link>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     {relatedHowTos.map((r) => (
                        <Link
                           key={r.href}
                           href={r.href}
                           className="group flex flex-col gap-2 rounded-2xl border border-viewerborder bg-viewerwhite p-5 transition-colors hover:border-viewerblue/30"
                        >
                           <div className="flex items-start justify-between gap-3">
                              <h3 className="text-[15.5px] font-semibold text-viewerblack tracking-tight">
                                 {r.title}
                              </h3>
                              <ArrowUpRight className="size-4 text-viewerlighttext transition-colors group-hover:text-viewerblack" />
                           </div>
                           <p className="text-[13px] text-viewertext leading-relaxed">
                              {r.description}
                           </p>
                        </Link>
                     ))}
                  </div>
               </div>
            </section>
         )}

         <section>
            <div className="w-full max-w-screen-xl mx-auto px-5 sm:px-6 md:px-12 lg:px-20 py-16 md:py-20">
               <div className="flex items-end justify-between gap-6 mb-8">
                  <div className="flex flex-col gap-2">
                     <span className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-viewerlighttext">
                        Keep exploring
                     </span>
                     <h2 className="text-[24px] sm:text-[30px] font-semibold tracking-tight text-viewerblack">
                        {relatedTitle}
                     </h2>
                  </div>
                  <Link
                     href="/use-cases"
                     className="hidden sm:inline-flex items-center gap-1 text-[13.5px] font-medium text-viewerblue hover:underline"
                  >
                     All use cases
                     <ArrowUpRight className="size-3.5" />
                  </Link>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {related.map((r) => (
                     <Link
                        key={r.href}
                        href={r.href}
                        className="group flex flex-col gap-2 rounded-2xl border border-viewerborder bg-viewerwhite p-5 transition-colors hover:border-viewerblue/30"
                     >
                        <div className="flex items-start justify-between gap-3">
                           <h3 className="text-[16px] font-semibold text-viewerblack tracking-tight">
                              {r.title}
                           </h3>
                           <ArrowUpRight className="size-4 text-viewerlighttext transition-colors group-hover:text-viewerblack" />
                        </div>
                        <p className="text-[13px] text-viewertext leading-relaxed">
                           {r.description}
                        </p>
                     </Link>
                  ))}
               </div>
            </div>
         </section>
      </main>
   );
};

export default UseCasePage;
