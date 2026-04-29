import { cn } from "@s3-viewer/ui/lib/utils";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type LegalContentItemProps = {
   title: string;
   content: ReactNode;
};

const slugify = (s: string) =>
   s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

const LegalContent = ({ content }: { content: LegalContentItemProps[] }) => {
   const slugs = useMemo(
      () => content.map((s) => slugify(s.title)),
      [content]
   );
   const [activeSlug, setActiveSlug] = useState<string | null>(slugs[0] ?? null);

   useEffect(() => {
      if (slugs.length === 0) return;

      const OFFSET = 140;

      let rafId = 0;
      let ticking = false;

      const compute = () => {
         let current = slugs[0];
         for (const slug of slugs) {
            const el = document.getElementById(slug);
            if (!el) continue;
            if (el.getBoundingClientRect().top - OFFSET <= 0) {
               current = slug;
            } else {
               break;
            }
         }
         setActiveSlug(current ?? null);
         ticking = false;
      };

      const onScroll = () => {
         if (ticking) return;
         rafId = requestAnimationFrame(compute);
         ticking = true;
      };

      compute();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });

      return () => {
         window.removeEventListener("scroll", onScroll);
         window.removeEventListener("resize", onScroll);
         cancelAnimationFrame(rafId);
      };
   }, [slugs]);

   return (
      <div className="w-full max-w-screen-xl mx-auto px-5 sm:px-6 md:px-12 lg:px-20 py-12 md:py-16 lg:py-20">
         <div className="grid lg:grid-cols-[240px_1fr] gap-10 lg:gap-16">
            <aside className="hidden lg:block">
               <div className="sticky top-28 flex flex-col gap-3">
                  <span className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-viewerlighttext">
                     On this page
                  </span>
                  <nav className="relative flex flex-col">
                     <span
                        aria-hidden
                        className="absolute left-0 top-0 bottom-0 w-px bg-viewerborder"
                     />
                     {content.map((section, i) => {
                        const slug = slugs[i];
                        const isActive = activeSlug === slug;
                        return (
                           <a
                              key={slug}
                              href={`#${slug}`}
                              className={cn(
                                 "relative pl-4 pr-2 py-2 text-[13px] leading-snug transition-colors",
                                 isActive
                                    ? "text-viewerblue font-semibold"
                                    : "text-viewertext hover:text-viewerblack"
                              )}
                           >
                              {isActive && (
                                 <span
                                    aria-hidden
                                    className="absolute left-0 top-1 bottom-1 w-[2px] rounded-full bg-viewerblue transition-all"
                                 />
                              )}
                              {section.title}
                           </a>
                        );
                     })}
                  </nav>
               </div>
            </aside>

            <div className="flex flex-col max-w-[760px] min-w-0">
               {content.map((section, i) => {
                  const slug = slugs[i];
                  return (
                     <section
                        key={slug}
                        id={slug}
                        className="scroll-mt-28 py-8 first:pt-0 last:pb-0 border-b border-viewerborder last:border-b-0"
                     >
                        <span className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-viewerlighttext">
                           Section {String(i + 1).padStart(2, "0")}
                        </span>
                        <h2 className="mt-2 text-[22px] sm:text-[26px] lg:text-[30px] font-semibold tracking-tight leading-[1.2] text-viewerblack">
                           {section.title}
                        </h2>
                        <div
                           className={cn(
                              "mt-5 text-[15px] sm:text-[16px] leading-[1.7] text-viewertext",
                              "[&_p]:m-0 [&_p+p]:mt-4",
                              "[&_strong]:font-semibold [&_strong]:text-viewerblack",
                              "[&_a]:text-viewerblue [&_a]:font-medium [&_a]:underline [&_a]:decoration-viewerblue/30 [&_a]:underline-offset-[3px] hover:[&_a]:decoration-viewerblue",
                              "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5"
                           )}
                        >
                           {typeof section.content === "string" ? (
                              <p>{section.content}</p>
                           ) : (
                              section.content
                           )}
                        </div>
                     </section>
                  );
               })}
            </div>
         </div>
      </div>
   );
};

export default LegalContent;
