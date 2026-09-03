import { GITHUB_URL } from "@/lib/site-config";
import { Button } from "@s3-viewer/ui/components/button";
import { cn } from "@s3-viewer/ui/lib/utils";
import { ArrowUpRight, ChevronRight, Lightbulb } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { FaGithub } from "react-icons/fa";

export type HowToStep = {
   title: string;
   body: ReactNode;
   code?: string;
};

export type HowToFAQ = {
   question: string;
   answer: string;
};

type LinkRef = { href: string; title: string; description: string };

export type HowToPageProps = {
   eyebrow: string;
   title: string;
   tldr: string;
   visual: ReactNode;
   steps: HowToStep[];
   underTheHood?: ReactNode;
   faqs: HowToFAQ[];
   useCases?: LinkRef[];
   related?: LinkRef[];
};

const HowToPage = ({
   eyebrow,
   title,
   tldr,
   visual,
   steps,
   underTheHood,
   faqs,
   useCases,
   related,
}: HowToPageProps) => {
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
                  <Link
                     href="/how-to"
                     className="transition-colors hover:text-viewerblack"
                  >
                     How-to
                  </Link>
                  <ChevronRight
                     className="size-3"
                     strokeWidth={2.5}
                     aria-hidden
                  />
                  <span className="font-medium text-viewerblack min-w-0 truncate">
                     {eyebrow}
                  </span>
               </nav>

               <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
                  <div className="lg:col-span-7 flex flex-col gap-5">
                     <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-viewerblack">
                        {title}
                     </h1>
                     <div className="flex items-start gap-3 rounded-xl border border-viewerborder bg-viewerwhite p-5">
                        <span className="grid place-items-center size-8 rounded-md bg-viewerblue/10 text-viewerblue flex-none">
                           <Lightbulb className="size-4" strokeWidth={2} />
                        </span>
                        <div className="flex flex-col gap-1">
                           <span className="text-xs font-medium tracking-wide uppercase text-viewerlighttext">
                              TL;DR
                           </span>
                           <p className="text-sm sm:text-base text-viewerblack leading-relaxed">
                              {tldr}
                           </p>
                        </div>
                     </div>
                  </div>
                  <div className="lg:col-span-5 w-full">{visual}</div>
               </div>
            </div>
         </section>

         <section>
            <div className="mx-auto w-full max-w-6xl px-6 py-20">
               <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                  <div className="lg:col-span-4 flex flex-col gap-3">
                     <span className="text-xs font-medium tracking-wide uppercase text-viewerlighttext">
                        Steps
                     </span>
                     <h2 className="text-3xl font-semibold tracking-tight text-viewerblack">
                        Step-by-step.
                     </h2>
                  </div>
                  <ol className="lg:col-span-8 flex flex-col gap-3">
                     {steps.map((step, i) => (
                        <li
                           key={step.title}
                           id={`step-${i + 1}`}
                           className={cn(
                              "flex flex-col gap-3 rounded-xl border border-viewerborder bg-viewerwhite p-5 sm:p-6 scroll-mt-24"
                           )}
                        >
                           <div className="flex items-start gap-5">
                              <span className="flex-none grid place-items-center size-9 rounded-full border border-viewerborder bg-viewergray text-sm font-semibold text-viewerblue">
                                 {String(i + 1).padStart(2, "0")}
                              </span>
                              <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                                 <h3 className="text-base font-semibold text-viewerblack tracking-tight">
                                    {step.title}
                                 </h3>
                                 <div className="text-sm text-viewertext leading-relaxed">
                                    {step.body}
                                 </div>
                              </div>
                           </div>
                           {step.code && (
                              <pre className="sm:ml-14 overflow-x-auto rounded-md border border-viewerborder bg-viewergray px-4 py-3 text-xs sm:text-xs leading-relaxed font-mono text-viewerblack">
                                 <code>{step.code}</code>
                              </pre>
                           )}
                        </li>
                     ))}
                  </ol>
               </div>
            </div>
         </section>

         {underTheHood && (
            <section className="border-t border-viewerborder bg-viewergray">
               <div className="mx-auto w-full max-w-6xl px-6 py-20">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                     <div className="lg:col-span-4 flex flex-col gap-3">
                        <span className="text-xs font-medium tracking-wide uppercase text-viewerlighttext">
                           Under the hood
                        </span>
                        <h2 className="text-3xl font-semibold tracking-tight text-viewerblack">
                           What&apos;s actually happening.
                        </h2>
                     </div>
                     <div className="lg:col-span-8">
                        <div className="rounded-xl border border-viewerborder bg-viewerwhite p-6 sm:p-8 text-sm text-viewertext leading-relaxed [&_strong]:text-viewerblack [&_strong]:font-semibold [&_code]:bg-viewergray [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono [&_code]:text-viewerblack">
                           {underTheHood}
                        </div>
                     </div>
                  </div>
               </div>
            </section>
         )}

         <section className="border-t border-viewerborder">
            <div className="mx-auto w-full max-w-6xl px-6 py-20">
               <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                  <div className="lg:col-span-4 flex flex-col gap-3">
                     <span className="text-xs font-medium tracking-wide uppercase text-viewerlighttext">
                        FAQ
                     </span>
                     <h2 className="text-3xl font-semibold tracking-tight text-viewerblack">
                        Common questions.
                     </h2>
                  </div>
                  <div className="lg:col-span-8 divide-y divide-viewerborder rounded-xl border border-viewerborder bg-viewerwhite">
                     {faqs.map((faq, i) => (
                        <details
                           key={i}
                           className="group p-5 sm:p-6 [&_svg]:open:rotate-90"
                        >
                           <summary className="flex cursor-pointer items-center justify-between gap-4 list-none">
                              <h3 className="text-base font-semibold text-viewerblack tracking-tight pr-2">
                                 {faq.question}
                              </h3>
                              <ChevronRight
                                 className="size-4 flex-none text-viewertext"
                                 aria-hidden
                              />
                           </summary>
                           <div className="mt-3 text-sm text-viewertext leading-relaxed pr-4">
                              {faq.answer}
                           </div>
                        </details>
                     ))}
                  </div>
               </div>
            </div>
         </section>

         <section className="border-t border-viewerborder bg-viewergray">
            <div className="mx-auto w-full max-w-6xl px-6 py-20">
               <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-10 items-center">
                  <div className="flex flex-col gap-4">
                     <span className="text-xs font-medium tracking-wide uppercase text-viewerlighttext">
                        Use S3 Viewer for this
                     </span>
                     <h2 className="text-3xl font-semibold tracking-tight text-viewerblack">
                        Skip the CLI. Try it in the browser.
                     </h2>
                     <p className="text-viewertext max-w-[540px]">
                        S3 Viewer turns the steps above into a single click.
                        Open source, self-hostable, free.
                     </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
                     <Button
                        asChild
                        size="lg"
                        className="h-11 px-6 text-[15px]"
                     >
                        <Link href="/dashboard">
                           Open app
                           <ChevronRight />
                        </Link>
                     </Button>
                     <Button
                        asChild
                        variant="outline"
                        size="lg"
                        className="h-11 px-6 text-[15px]"
                     >
                        <Link
                           href={GITHUB_URL}
                           target="_blank"
                           rel="noreferrer"
                        >
                           <FaGithub />
                           Star on GitHub
                        </Link>
                     </Button>
                  </div>
               </div>
            </div>
         </section>

         {((useCases && useCases.length > 0) ||
            (related && related.length > 0)) && (
            <section>
               <div className="mx-auto w-full max-w-6xl px-6 py-20 grid grid-cols-1 lg:grid-cols-2 gap-12">
                  {useCases && useCases.length > 0 && (
                     <div>
                        <div className="flex items-end justify-between gap-6 mb-6">
                           <div className="flex flex-col gap-1">
                              <span className="text-xs font-medium tracking-wide uppercase text-viewerlighttext">
                                 Use case
                              </span>
                              <h2 className="text-xl font-semibold tracking-tight text-viewerblack">
                                 Why teams pick this
                              </h2>
                           </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                           {useCases.map((r) => (
                              <Link
                                 key={r.href}
                                 href={r.href}
                                 className="group flex items-start justify-between gap-4 rounded-xl border border-viewerborder bg-viewerwhite p-5 transition-colors hover:border-viewerblue/30"
                              >
                                 <div className="flex flex-col gap-1.5 min-w-0">
                                    <h3 className="text-sm font-semibold text-viewerblack tracking-tight">
                                       {r.title}
                                    </h3>
                                    <p className="text-sm text-viewertext">
                                       {r.description}
                                    </p>
                                 </div>
                                 <ArrowUpRight className="size-4 flex-none text-viewerlighttext transition-colors group-hover:text-viewerblack mt-1" />
                              </Link>
                           ))}
                        </div>
                     </div>
                  )}

                  {related && related.length > 0 && (
                     <div>
                        <div className="flex items-end justify-between gap-6 mb-6">
                           <div className="flex flex-col gap-1">
                              <span className="text-xs font-medium tracking-wide uppercase text-viewerlighttext">
                                 Related guides
                              </span>
                              <h2 className="text-xl font-semibold tracking-tight text-viewerblack">
                                 More how-tos
                              </h2>
                           </div>
                           <Link
                              href="/how-to"
                              className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-viewerblue hover:underline"
                           >
                              All
                              <ArrowUpRight className="size-3.5" />
                           </Link>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                           {related.map((r) => (
                              <Link
                                 key={r.href}
                                 href={r.href}
                                 className="group flex items-start justify-between gap-4 rounded-xl border border-viewerborder bg-viewerwhite p-5 transition-colors hover:border-viewerblue/30"
                              >
                                 <div className="flex flex-col gap-1.5 min-w-0">
                                    <h3 className="text-sm font-semibold text-viewerblack tracking-tight">
                                       {r.title}
                                    </h3>
                                    <p className="text-sm text-viewertext">
                                       {r.description}
                                    </p>
                                 </div>
                                 <ArrowUpRight className="size-4 flex-none text-viewerlighttext transition-colors group-hover:text-viewerblack mt-1" />
                              </Link>
                           ))}
                        </div>
                     </div>
                  )}
               </div>
            </section>
         )}
      </main>
   );
};

export default HowToPage;
