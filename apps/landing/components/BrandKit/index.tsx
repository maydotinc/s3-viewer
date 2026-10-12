import BasicBlock, {
   Eyebrow,
   PageTitle,
   SectionTitle,
} from "@/components/basic-block";
import OnThisPage from "@/components/on-this-page";
import PageHero from "@/components/page-hero";
import { SITE_URL } from "@/lib/site-config";
import { cn } from "@s3-viewer/ui/lib/utils";
import { Check, Copy, Download } from "lucide-react";
import Image from "next/image";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { COLORS, LOGOS, SECTIONS, TYPE_SCALE, VOICE_EXAMPLES } from "./data";

const FOCUS =
   "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-viewerblue";

const BrandSection = ({
   id,
   intro,
   children,
}: {
   id: (typeof SECTIONS)[number]["id"];
   intro: ReactNode;
   children: ReactNode;
}) => {
   const index = SECTIONS.findIndex((section) => section.id === id);
   return (
      <section id={id} className="flex flex-col gap-6">
         <div className="flex flex-col gap-2">
            <Eyebrow>Section {String(index + 1).padStart(2, "0")}</Eyebrow>
            <SectionTitle>{SECTIONS[index]?.title}</SectionTitle>
            <p className="text-sm text-viewertext max-w-[600px]">{intro}</p>
         </div>
         {children}
      </section>
   );
};

const BrandKit = () => {
   const [copiedId, setCopiedId] = useState<string | null>(null);
   const resetTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

   useEffect(() => () => clearTimeout(resetTimer.current), []);

   const copyValue = async (id: string, value: string) => {
      try {
         await navigator.clipboard.writeText(value);
         setCopiedId(id);
         clearTimeout(resetTimer.current);
         resetTimer.current = setTimeout(() => setCopiedId(null), 1200);
      } catch {
         setCopiedId(null);
      }
   };

   return (
      <main className="w-full overflow-x-clip">
         <PageHero current="Brand kit">
            <div className="flex flex-col gap-5 max-w-[760px]">
               <PageTitle>
                  The S3 Viewer brand,
                  <br />
                  in one place.
               </PageTitle>
               <p className="text-viewertext max-w-[600px]">
                  Logos, colors, type, and voice. Use these assets when writing
                  about S3 Viewer, integrating with us, or building on top of
                  the open-source code.
               </p>
            </div>
         </PageHero>

         <BasicBlock>
            <div className="grid lg:grid-cols-[220px_1fr] gap-10 lg:gap-16">
               <OnThisPage items={SECTIONS} />

               <div className="flex flex-col gap-16 max-w-[860px] min-w-0">
                  <BrandSection
                     id="logos"
                     intro={
                        <>
                           Always preserve clear space equal to the height of
                           the &ldquo;S&rdquo; in the wordmark. Never recolor,
                           rotate, or reproportion the marks.
                        </>
                     }
                  >
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {LOGOS.map((logo) => {
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
                                    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
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
                                       onClick={() => copyValue(logo.id, url)}
                                       className={cn(
                                          "flex flex-1 items-center justify-center gap-1.5 rounded-md bg-viewergray px-2.5 py-2.5 text-xs font-medium text-viewertext transition-colors hover:bg-viewerborder/70 cursor-pointer sm:py-2",
                                          FOCUS
                                       )}
                                    >
                                       {isCopied ? (
                                          <Check className="size-3.5" />
                                       ) : (
                                          <Copy className="size-3.5" />
                                       )}
                                       <span
                                          className="grid"
                                          aria-live="polite"
                                       >
                                          <span
                                             aria-hidden={isCopied}
                                             className={cn(
                                                "col-start-1 row-start-1",
                                                isCopied && "invisible"
                                             )}
                                          >
                                             Copy URL
                                          </span>
                                          <span
                                             aria-hidden={!isCopied}
                                             className={cn(
                                                "col-start-1 row-start-1",
                                                !isCopied && "invisible"
                                             )}
                                          >
                                             Copied
                                          </span>
                                       </span>
                                    </button>
                                    <a
                                       href={logo.path}
                                       download={logo.filename}
                                       className={cn(
                                          "flex items-center justify-center gap-1.5 rounded-md bg-viewerblack px-2.5 py-2.5 text-xs font-medium text-viewerwhite transition-colors hover:bg-viewerblack/85 sm:py-2",
                                          FOCUS
                                       )}
                                    >
                                       <Download className="size-3.5" />
                                       SVG
                                    </a>
                                 </div>
                              </div>
                           );
                        })}
                     </div>
                  </BrandSection>

                  <BrandSection
                     id="colors"
                     intro="Viewer Blue is the only brand-defining color. Everything else is grayscale. Outside the app icon, we do not use gradients."
                  >
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {COLORS.map((color) => {
                           const isCopied = copiedId === color.id;
                           return (
                              <button
                                 key={color.id}
                                 type="button"
                                 onClick={() => copyValue(color.id, color.hex)}
                                 className={cn(
                                    "group flex items-stretch gap-0 rounded-xl border border-viewerborder bg-viewerwhite overflow-hidden text-left transition-colors hover:border-viewerblue/40 cursor-pointer",
                                    FOCUS
                                 )}
                              >
                                 <div
                                    className="w-16 flex-none border-r border-viewerborder sm:w-20"
                                    style={{ backgroundColor: color.hex }}
                                 />
                                 <div className="flex flex-1 flex-col gap-1 p-4 min-w-0">
                                    <div className="flex flex-col items-start gap-1.5">
                                       <span className="text-sm font-semibold text-viewerblack">
                                          {color.name}
                                       </span>
                                       <span className="flex shrink-0 items-center gap-1 text-xs text-viewerlighttext font-mono">
                                          {isCopied ? (
                                             <Check className="size-3" />
                                          ) : (
                                             <Copy className="size-3 text-viewerlighttext" />
                                          )}
                                          {color.hex}
                                       </span>
                                    </div>
                                    <p className="text-xs text-viewertext leading-relaxed">
                                       {color.role}
                                    </p>
                                 </div>
                              </button>
                           );
                        })}
                     </div>
                  </BrandSection>

                  <BrandSection
                     id="typography"
                     intro={
                        <>
                           We use{" "}
                           <strong className="text-viewerblack">Inter</strong>{" "}
                           everywhere. Tight tracking on display sizes, relaxed
                           leading on body copy.
                        </>
                     }
                  >
                     <div className="rounded-xl border border-viewerborder bg-viewerwhite divide-y divide-viewerborder">
                        {TYPE_SCALE.map((row) => (
                           <div
                              key={row.label}
                              className="flex flex-col gap-2 p-5 sm:p-6"
                           >
                              <Eyebrow>{row.label}</Eyebrow>
                              <span className={row.className}>
                                 {row.sample}
                              </span>
                              <span className="text-xs text-viewerlighttext font-mono">
                                 {row.meta}
                              </span>
                           </div>
                        ))}
                     </div>
                  </BrandSection>

                  <BrandSection
                     id="voice"
                     intro="Plain. Direct. Confident without hype."
                  >
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {VOICE_EXAMPLES.map((row) => (
                           <div
                              key={row.line}
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
                  </BrandSection>
               </div>
            </div>
         </BasicBlock>
      </main>
   );
};

export default BrandKit;
