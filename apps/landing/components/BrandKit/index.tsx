import { SITE_URL } from "@/lib/site-config";
import { cn } from "@s3-viewer/ui/lib/utils";
import {
   Check,
   ChevronRight,
   Copy,
   Download,
   Type,
   Palette,
   ImageIcon,
   AlignLeft,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type ColorToken = {
   id: string;
   name: string;
   hex: string;
   role: string;
   onDark?: boolean;
};

const colors: ColorToken[] = [
   {
      id: "viewer-blue",
      name: "Viewer Blue",
      hex: "#3658C1",
      role: "Primary brand color. Used for CTAs and accents.",
      onDark: true,
   },
   {
      id: "viewer-dark-blue",
      name: "Viewer Dark Blue",
      hex: "#253977",
      role: "Hero backgrounds and emphasis surfaces.",
      onDark: true,
   },
   {
      id: "viewer-black",
      name: "Viewer Black",
      hex: "#0E121B",
      role: "Headings and high-emphasis text.",
      onDark: true,
   },
   {
      id: "viewer-text",
      name: "Viewer Text",
      hex: "#525866",
      role: "Body copy and secondary text.",
      onDark: true,
   },
   {
      id: "viewer-light",
      name: "Viewer Light",
      hex: "#99A0AE",
      role: "Captions and meta text.",
   },
   {
      id: "viewer-border",
      name: "Viewer Border",
      hex: "#E1E4EA",
      role: "Hairlines and dividers.",
   },
   {
      id: "viewer-gray",
      name: "Viewer Gray",
      hex: "#F7F7F7",
      role: "Muted surfaces and section backgrounds.",
   },
   {
      id: "viewer-white",
      name: "Viewer White",
      hex: "#FFFFFF",
      role: "Default page background.",
   },
];

type LogoAsset = {
   id: string;
   name: string;
   description: string;
   filename: string;
   url: string;
   preview: React.ReactNode;
};

const logos: LogoAsset[] = [
   {
      id: "full-logo",
      name: "Wordmark",
      description: "Primary lockup. Use on light backgrounds.",
      filename: "viewer.svg",
      url: `${SITE_URL}/icons/viewer.svg`,
      preview: (
         <div className="flex h-full w-full items-center justify-center rounded-md bg-viewerwhite p-6">
            <img
               src="/icons/viewer.svg"
               alt="S3 Viewer wordmark"
               className="h-9 w-auto object-contain"
               draggable={false}
            />
         </div>
      ),
   },
   {
      id: "white-logo",
      name: "Wordmark on Brand",
      description: "Reverse lockup. Use on Viewer Blue or photography.",
      filename: "whiteviewer.svg",
      url: `${SITE_URL}/icons/whiteviewer.svg`,
      preview: (
         <div className="flex h-full w-full items-center justify-center rounded-md bg-viewerblue p-6">
            <img
               src="/icons/whiteviewer.svg"
               alt="S3 Viewer wordmark on brand"
               className="h-9 w-auto object-contain"
               draggable={false}
            />
         </div>
      ),
   },
   {
      id: "app-icon",
      name: "App Icon",
      description: "Filled mark. App icons, favicons, square avatars.",
      filename: "viewerblue.svg",
      url: `${SITE_URL}/icons/viewerblue.svg`,
      preview: (
         <div className="flex h-full w-full items-center justify-center rounded-md bg-viewergray p-6">
            <img
               src="/icons/viewerblue.svg"
               alt="S3 Viewer app icon"
               className="h-14 w-14 object-contain"
               draggable={false}
            />
         </div>
      ),
   },
   {
      id: "mark-only",
      name: "Mark",
      description: "Outline mark. Use when wordmark is unnecessary.",
      filename: "logo.svg",
      url: `${SITE_URL}/logo.svg`,
      preview: (
         <div className="flex h-full w-full items-center justify-center rounded-md bg-viewergray p-6">
            <img
               src="/logo.svg"
               alt="S3 Viewer mark"
               className="h-14 w-14 object-contain"
               draggable={false}
            />
         </div>
      ),
   },
];

type Section = {
   id: string;
   eyebrow: string;
   title: string;
   icon: typeof Palette;
};

const sections: Section[] = [
   {
      id: "logos",
      eyebrow: "Section 01",
      title: "Logos",
      icon: ImageIcon,
   },
   {
      id: "colors",
      eyebrow: "Section 02",
      title: "Colors",
      icon: Palette,
   },
   {
      id: "typography",
      eyebrow: "Section 03",
      title: "Typography",
      icon: Type,
   },
   {
      id: "voice",
      eyebrow: "Section 04",
      title: "Voice",
      icon: AlignLeft,
   },
];

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
                     Brand Kit
                  </span>
               </nav>

               <div className="flex flex-col gap-5 max-w-[760px] motion-fade-up">
                  <h1 className="text-[30px] sm:text-[44px] lg:text-[56px] font-semibold tracking-[-0.02em] leading-[1.06] text-viewerblack">
                     The S3 Viewer brand,
                     <br />
                     in one place.
                  </h1>
                  <p className="text-[16px] sm:text-[17px] text-viewertext leading-relaxed max-w-[600px]">
                     Logos, colors, type, and voice. Use these assets when
                     writing about S3 Viewer, integrating with us, or building
                     on top of the open-source code.
                  </p>
               </div>
            </div>
         </section>

         <section>
            <div className="w-full max-w-screen-xl mx-auto px-5 sm:px-6 md:px-12 lg:px-20 py-12 md:py-16 lg:py-20">
               <div className="grid lg:grid-cols-[220px_1fr] gap-10 lg:gap-16">
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
                           {sections.map((s) => {
                              const isActive = activeSlug === s.id;
                              return (
                                 <a
                                    key={s.id}
                                    href={`#${s.id}`}
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
                           <span className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-viewerlighttext">
                              Section 01
                           </span>
                           <h2 className="text-[26px] sm:text-[30px] font-semibold tracking-tight text-viewerblack">
                              Logos
                           </h2>
                           <p className="text-[14.5px] text-viewertext max-w-[600px]">
                              Always preserve clear space equal to the height
                              of the &ldquo;S&rdquo; in the wordmark. Never
                              recolor, rotate, or reproportion the marks.
                           </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                           {logos.map((logo) => {
                              const isCopied = copiedId === logo.id;
                              return (
                                 <div
                                    key={logo.id}
                                    className="flex flex-col gap-3 rounded-2xl border border-viewerborder bg-viewerwhite p-3 transition-colors hover:border-viewerblue/40"
                                 >
                                    <div className="aspect-[2/1] w-full overflow-hidden rounded-xl border border-viewerborder">
                                       {logo.preview}
                                    </div>
                                    <div className="flex flex-col gap-1 px-1">
                                       <div className="flex items-center justify-between gap-2">
                                          <span className="text-[14px] font-semibold text-viewerblack">
                                             {logo.name}
                                          </span>
                                          <span className="text-[11px] text-viewerlighttext font-mono">
                                             {logo.filename}
                                          </span>
                                       </div>
                                       <p className="text-[12.5px] text-viewertext leading-relaxed">
                                          {logo.description}
                                       </p>
                                    </div>
                                    <div className="flex items-center gap-2 px-1 pb-1">
                                       <button
                                          type="button"
                                          onClick={() =>
                                             copyValue(logo.id, logo.url)
                                          }
                                          className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-viewergray px-2.5 py-2 text-[12px] font-medium text-viewertext transition-colors hover:bg-viewerborder/70 cursor-pointer"
                                       >
                                          {isCopied ? (
                                             <Check className="size-3.5" />
                                          ) : (
                                             <Copy className="size-3.5" />
                                          )}
                                          {isCopied ? "Copied" : "Copy URL"}
                                       </button>
                                       <a
                                          href={logo.url}
                                          download
                                          className="flex items-center justify-center gap-1.5 rounded-md bg-viewerblack px-2.5 py-2 text-[12px] font-medium text-viewerwhite transition-colors hover:bg-viewerblack/85"
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
                           <span className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-viewerlighttext">
                              Section 02
                           </span>
                           <h2 className="text-[26px] sm:text-[30px] font-semibold tracking-tight text-viewerblack">
                              Colors
                           </h2>
                           <p className="text-[14.5px] text-viewertext max-w-[600px]">
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
                                    className="group flex items-stretch gap-0 rounded-2xl border border-viewerborder bg-viewerwhite overflow-hidden text-left transition-colors hover:border-viewerblue/40 cursor-pointer"
                                 >
                                    <div
                                       className="w-24 flex-none border-r border-viewerborder"
                                       style={{ backgroundColor: color.hex }}
                                    />
                                    <div className="flex flex-1 flex-col gap-1 p-4 min-w-0">
                                       <div className="flex items-center justify-between gap-2">
                                          <span className="text-[13.5px] font-semibold text-viewerblack truncate">
                                             {color.name}
                                          </span>
                                          <span className="flex items-center gap-1 text-[11px] text-viewerlighttext font-mono">
                                             {isCopied ? (
                                                <Check className="size-3" />
                                             ) : (
                                                <Copy className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                                             )}
                                             {color.hex}
                                          </span>
                                       </div>
                                       <p className="text-[12px] text-viewertext leading-relaxed line-clamp-2">
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
                           <span className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-viewerlighttext">
                              Section 03
                           </span>
                           <h2 className="text-[26px] sm:text-[30px] font-semibold tracking-tight text-viewerblack">
                              Typography
                           </h2>
                           <p className="text-[14.5px] text-viewertext max-w-[600px]">
                              We use{" "}
                              <strong className="text-viewerblack">
                                 Inter
                              </strong>{" "}
                              everywhere. Tight tracking on display sizes,
                              relaxed leading on body copy.
                           </p>
                        </div>

                        <div className="rounded-2xl border border-viewerborder bg-viewerwhite divide-y divide-viewerborder">
                           {[
                              {
                                 label: "Display",
                                 sample: "Object storage, simplified.",
                                 className:
                                    "text-[40px] sm:text-[52px] tracking-[-0.02em] leading-[1.04] font-semibold text-viewerblack",
                                 meta: "Inter Semibold · 52 / 54 · -2% letter",
                              },
                              {
                                 label: "Heading",
                                 sample: "Browse every bucket.",
                                 className:
                                    "text-[26px] sm:text-[30px] tracking-tight leading-[1.2] font-semibold text-viewerblack",
                                 meta: "Inter Semibold · 30 / 36",
                              },
                              {
                                 label: "Body",
                                 sample:
                                    "S3 Viewer is a fast, open-source viewer for any S3-compatible API.",
                                 className:
                                    "text-[16px] leading-[1.7] text-viewertext",
                                 meta: "Inter Regular · 16 / 28",
                              },
                              {
                                 label: "Caption",
                                 sample: "Last updated April 28, 2026",
                                 className:
                                    "text-[12px] tracking-[0.02em] text-viewerlighttext",
                                 meta: "Inter Medium · 12 / 18",
                              },
                           ].map((row) => (
                              <div
                                 key={row.label}
                                 className="flex flex-col gap-2 p-5 sm:p-6"
                              >
                                 <span className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-viewerlighttext">
                                    {row.label}
                                 </span>
                                 <span className={cn(row.className)}>
                                    {row.sample}
                                 </span>
                                 <span className="text-[11.5px] text-viewerlighttext font-mono">
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
                           <span className="text-[10.5px] font-semibold tracking-[0.14em] uppercase text-viewerlighttext">
                              Section 04
                           </span>
                           <h2 className="text-[26px] sm:text-[30px] font-semibold tracking-tight text-viewerblack">
                              Voice
                           </h2>
                           <p className="text-[14.5px] text-viewertext max-w-[600px]">
                              Plain. Direct. Confident without hype.
                           </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                           {[
                              {
                                 ok: true,
                                 label: "Use",
                                 line: "Connect any S3-compatible bucket in one click.",
                              },
                              {
                                 ok: false,
                                 label: "Avoid",
                                 line: "Revolutionary AI-powered cloud storage hub.",
                              },
                              {
                                 ok: true,
                                 label: "Use",
                                 line: "Your credentials are encrypted at rest.",
                              },
                              {
                                 ok: false,
                                 label: "Avoid",
                                 line: "Bank-grade military-level enterprise security.",
                              },
                           ].map((row, i) => (
                              <div
                                 key={i}
                                 className={cn(
                                    "flex flex-col gap-2 rounded-2xl border p-5",
                                    row.ok
                                       ? "border-viewerblue/30 bg-viewerblue/[0.04]"
                                       : "border-viewerborder bg-viewergray"
                                 )}
                              >
                                 <span
                                    className={cn(
                                       "text-[10.5px] font-semibold tracking-[0.14em] uppercase",
                                       row.ok
                                          ? "text-viewerblue"
                                          : "text-viewerlighttext"
                                    )}
                                 >
                                    {row.label}
                                 </span>
                                 <p className="text-[14.5px] leading-relaxed text-viewerblack">
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
