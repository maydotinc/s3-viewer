import { SITE_URL } from "@/lib/site-config";
import { cn } from "@s3-viewer/ui/lib/utils";
import { Check, ChevronRight, Copy, Download } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
   COLORS as colors,
   LOGOS as logos,
   SECTIONS as sections,
   TYPE_SCALE as typeScale,
   VOICE_EXAMPLES as voiceExamples,
} from "./data";

const BrandKit = () => {
   const [copiedId, setCopiedId] = useState<string | null>(null);
   const [activeSlug, setActiveSlug] = useState<string | null>(
      sections[0]?.id ?? null
   );

   useEffect(() => {
      const slugs = sections.map((s) => s.id);
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
   }, []);

   const copyValue = async (id: string, value: string) => {
      try {
         await navigator.clipboard.writeText(value);
         setCopiedId(id);
         setTimeout(() => {
            setCopiedId((current) => (current === id ? null : current));
         }, 1200);
      } catch {
         setCopiedId(null);
      }
   };

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
                     Brand Kit
                  </span>
               </nav>

               <div className="flex flex-col gap-5 max-w-[760px]">
                  <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-viewerblack">
                     The S3 Viewer brand,
                     <br />
                     in one place.
                  </h1>
                  <p className="text-viewertext max-w-[600px]">
                     Logos, colors, type, and voice. Use these assets when
                     writing about S3 Viewer, integrating with us, or building
                     on top of the open-source code.
                  </p>
               </div>
            </div>
         </section>

         <section>
            <div className="mx-auto w-full max-w-6xl px-6 py-20">
               <div className="grid lg:grid-cols-[220px_1fr] gap-10 lg:gap-16">
                  <aside className="hidden lg:block">
                     <div className="sticky top-28 flex flex-col gap-3">
                        <span className="text-xs font-medium tracking-wide uppercase text-viewerlighttext">
                           On this page
                        </span>
                        <nav className="relative flex flex-col">
                           <span
                              aria-hidden
                              className="absolute left-0 top-0 bottom-0 w-px bg-viewerborder"
                           />
                           {sections.map((s) => {
                              const isActive = activeSlug === s.id;
                              return (
                                 <a
                                    key={s.id}
                                    href={`#${s.id}`}
                                    className={cn(
                                       "relative pl-4 pr-2 py-2 text-sm leading-snug transition-colors",
                                       isActive
                                          ? "text-viewerblue font-semibold"
                                          : "text-viewertext hover:text-viewerblack"
                                    )}
                                 >
                                    {isActive && (
                                       <span
                                          aria-hidden
                                          className="absolute left-0 top-1 bottom-1 w-[2px] rounded-full bg-viewerblue"
                                       />
                                    )}
                                    {s.title}
                                 </a>
                              );
                           })}
                        </nav>
                     </div>
                  </aside>

                  <div className="flex flex-col gap-16 max-w-[860px] min-w-0">
                     <section
                        id="logos"
                        className="scroll-mt-28 flex flex-col gap-6"
                     >
                        <div className="flex flex-col gap-2">
                           <span className="text-xs font-medium tracking-wide uppercase text-viewerlighttext">
                              Section 01
                           </span>
                           <h2 className="text-3xl font-semibold tracking-tight text-viewerblack">
                              Logos
                           </h2>
                           <p className="text-sm text-viewertext max-w-[600px]">
                              Always preserve clear space equal to the height of
                              the &ldquo;S&rdquo; in the wordmark. Never
                              recolor, rotate, or reproportion the marks.
                           </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                           {logos.map((logo) => {
                              const isCopied = copiedId === logo.id;
                              const url = `${SITE_URL}${logo.path}`;
                              return (
                                 <div
                                    key={logo.id}
                                    className="flex flex-col gap-3 rounded-xl border border-viewerborder bg-viewerwhite p-3 transition-colors hover:border-viewerblue/40"
                                 >
                                    <div className="aspect-[2/1] w-full overflow-hidden rounded-xl border border-viewerborder">
                                       <div
                                          className={cn(
                                             "flex h-full w-full items-center justify-center rounded-md p-6",
                                             logo.previewBg
                                          )}
                                       >
                                          <Image
                                             src={logo.path}
                                             alt={logo.alt}
                                             className={cn(
                                                "object-contain",
                                                logo.previewSize
                                             )}
                                             draggable={false}
                                             width={160}
                                             height={36}
                                             unoptimized
                                          />
                                       </div>
                                    </div>
                                    <div className="flex flex-col gap-1 px-1">
                                       <div className="flex items-center justify-between gap-2">
                                          <span className="text-sm font-semibold text-viewerblack">
                                             {logo.name}
                                          </span>
                                          <span className="text-xs text-viewerlighttext font-mono">
                                             {logo.filename}
                                          </span>
                                       </div>
                                       <p className="text-xs text-viewertext leading-relaxed">
                                          {logo.description}
                                       </p>
                                    </div>
                                    <div className="flex items-center gap-2 px-1 pb-1">
                                       <button
                                          type="button"
                                          onClick={() =>
                                             copyValue(logo.id, url)
                                          }
                                          className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-viewergray px-2.5 py-2 text-xs font-medium text-viewertext transition-colors hover:bg-viewerborder/70 cursor-pointer"
                                       >
                                          {isCopied ? (
                                             <Check className="size-3.5" />
                                          ) : (
                                             <Copy className="size-3.5" />
                                          )}
                                          {isCopied ? "Copied" : "Copy URL"}
                                       </button>
                                       <a
                                          href={logo.path}
                                          download={logo.filename}
                                          className="flex items-center justify-center gap-1.5 rounded-md bg-viewerblack px-2.5 py-2 text-xs font-medium text-viewerwhite transition-colors hover:bg-viewerblack/85"
                                       >
                                          <Download className="size-3.5" />
                                          SVG
                                       </a>
                                    </div>
                                 </div>
                              );
                           })}
                        </div>
                     </section>

                     <section
                        id="colors"
                        className="scroll-mt-28 flex flex-col gap-6"
                     >
                        <div className="flex flex-col gap-2">
                           <span className="text-xs font-medium tracking-wide uppercase text-viewerlighttext">
                              Section 02
                           </span>
                           <h2 className="text-3xl font-semibold tracking-tight text-viewerblack">
                              Colors
                           </h2>
                           <p className="text-sm text-viewertext max-w-[600px]">
                              Viewer Blue is the only brand-defining color.
                              Everything else is grayscale. We do not use
                              gradients.
                           </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3">
                           {colors.map((color) => {
                              const isCopied = copiedId === color.id;
                              return (
                                 <button
                                    key={color.id}
                                    type="button"
                                    onClick={() =>
                                       copyValue(color.id, color.hex)
                                    }
                                    className="group flex items-stretch gap-0 rounded-xl border border-viewerborder bg-viewerwhite overflow-hidden text-left transition-colors hover:border-viewerblue/40 cursor-pointer"
                                 >
                                    <div
                                       className="w-24 flex-none border-r border-viewerborder"
                                       style={{ backgroundColor: color.hex }}
                                    />
                                    <div className="flex flex-1 flex-col gap-1 p-4 min-w-0">
                                       <div className="flex items-center justify-between gap-2">
                                          <span className="text-sm font-semibold text-viewerblack truncate">
                                             {color.name}
                                          </span>
                                          <span className="flex items-center gap-1 text-xs text-viewerlighttext font-mono">
                                             {isCopied ? (
                                                <Check className="size-3" />
                                             ) : (
                                                <Copy className="size-3 text-viewerlighttext" />
                                             )}
                                             {color.hex}
                                          </span>
                                       </div>
                                       <p className="text-xs text-viewertext leading-relaxed line-clamp-2">
                                          {color.role}
                                       </p>
                                    </div>
                                 </button>
                              );
                           })}
                        </div>
                     </section>

                     <section
                        id="typography"
                        className="scroll-mt-28 flex flex-col gap-6"
                     >
                        <div className="flex flex-col gap-2">
                           <span className="text-xs font-medium tracking-wide uppercase text-viewerlighttext">
                              Section 03
                           </span>
                           <h2 className="text-3xl font-semibold tracking-tight text-viewerblack">
                              Typography
                           </h2>
                           <p className="text-sm text-viewertext max-w-[600px]">
                              We use{" "}
                              <strong className="text-viewerblack">
                                 Inter
                              </strong>{" "}
                              everywhere. Tight tracking on display sizes,
                              relaxed leading on body copy.
                           </p>
                        </div>

                        <div className="rounded-xl border border-viewerborder bg-viewerwhite divide-y divide-viewerborder">
                           {typeScale.map((row) => (
                              <div
                                 key={row.label}
                                 className="flex flex-col gap-2 p-5 sm:p-6"
                              >
                                 <span className="text-xs font-medium tracking-wide uppercase text-viewerlighttext">
                                    {row.label}
                                 </span>
                                 <span className={cn(row.className)}>
                                    {row.sample}
                                 </span>
                                 <span className="text-xs text-viewerlighttext font-mono">
                                    {row.meta}
                                 </span>
                              </div>
                           ))}
                        </div>
                     </section>

                     <section
                        id="voice"
                        className="scroll-mt-28 flex flex-col gap-6"
                     >
                        <div className="flex flex-col gap-2">
                           <span className="text-xs font-medium tracking-wide uppercase text-viewerlighttext">
                              Section 04
                           </span>
                           <h2 className="text-3xl font-semibold tracking-tight text-viewerblack">
                              Voice
                           </h2>
                           <p className="text-sm text-viewertext max-w-[600px]">
                              Plain. Direct. Confident without hype.
                           </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                           {voiceExamples.map((row, i) => (
                              <div
                                 key={i}
                                 className={cn(
                                    "flex flex-col gap-2 rounded-xl border p-5",
                                    row.ok
                                       ? "border-viewerblue/30 bg-viewerblue/[0.04]"
                                       : "border-viewerborder bg-viewergray"
                                 )}
                              >
                                 <span
                                    className={cn(
                                       "text-xs font-medium tracking-wide uppercase",
                                       row.ok
                                          ? "text-viewerblue"
                                          : "text-viewerlighttext"
                                    )}
                                 >
                                    {row.label}
                                 </span>
                                 <p className="text-sm leading-relaxed text-viewerblack">
                                    {row.line}
                                 </p>
                              </div>
                           ))}
                        </div>
                     </section>
                  </div>
               </div>
            </div>
         </section>
      </main>
   );
};

export default BrandKit;
