import { SITE_URL } from "@/lib/site-config";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const colors = [
   { id: "viewer-blue", name: "Viewer Blue", hex: "#3658C1" },
   { id: "viewer-dark-blue", name: "Viewer Dark Blue", hex: "#253977" },
];

const logos = [
   {
      id: "full-logo",
      name: "Full Logo",
      preview: (
         <div className="rounded-md bg-white p-2">
            <img
               src="/icons/viewer.svg"
               alt="S3 Viewer full logo"
               className="h-8 w-auto object-contain"
               draggable={false}
            />
         </div>
      ),
      url: `${SITE_URL}/icons/viewer.svg`,
   },
   {
      id: "app-icon",
      name: "App Icon",
      preview: (
         <div className="size-20 p-3">
            <img
               src="/icons/viewerblue.svg"
               alt="S3 Viewer app icon"
               className="h-full w-full object-contain"
               draggable={false}
            />
         </div>
      ),
      url: `${SITE_URL}/icons/viewerblue.svg`,
   },
   {
      id: "mark-only",
      name: "Mark Only",
      preview: (
         <div className="h-20 w-20 rounded-lg bg-viewergray p-6">
            <img
               src="/logo.svg"
               alt="S3 Viewer logo mark"
               className="h-full w-full object-contain"
               draggable={false}
            />
         </div>
      ),
      url: `${SITE_URL}/logo.svg`,
   },
   {
      id: "white-logo",
      name: "White Logo",
      preview: (
         <div className="rounded-md bg-viewerblue p-6">
            <img
               src="/icons/whiteviewer.svg"
               alt="S3 Viewer white logo"
               className="h-8 w-auto object-contain"
               draggable={false}
            />
         </div>
      ),
      url: `${SITE_URL}/icons/whiteviewer.svg`,
   },
];

const BrandKit = () => {
   const [copiedId, setCopiedId] = useState<string | null>(null);

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
      <div className="flex min-h-[100dvh] flex-col px-5 py-8 sm:px-8">
         <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col space-y-8">
            <div className="flex flex-col space-y-10">
               <h1 className="text-3xl font-semibold text-viewerblack">
                  S3 Viewer Brand Kit
               </h1>

               <section className="flex flex-col space-y-4">
                  <h2 className="text-xs font-medium uppercase tracking-wider text-viewerlighttext">
                     Colors
                  </h2>
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8">
                     {colors.map((color) => {
                        const isCopied = copiedId === color.id;

                        return (
                           <div key={color.id} className="flex flex-col gap-2">
                              <div
                                 className="h-20 w-full rounded-lg border border-viewerborder"
                                 style={{ backgroundColor: color.hex }}
                              />
                              <span className="text-sm text-viewertext">{color.name}</span>
                              <button
                                 type="button"
                                 onClick={() => copyValue(color.id, color.hex)}
                                 className="flex min-h-[44px] cursor-pointer items-center justify-between gap-2 rounded-lg bg-[#eef0f4] px-3 py-2 font-mono text-sm text-[#2f3540] hover:bg-[#e3e7ee] focus:outline-none"
                                 title="Copy hex"
                              >
                                 <span className="select-all">{color.hex}</span>
                                 <span className="text-viewerlighttext">
                                    {isCopied ? "Copied" : "Copy"}
                                 </span>
                              </button>
                           </div>
                        );
                     })}
                  </div>
               </section>

               <section className="flex flex-col space-y-4">
                  <h2 className="text-xs font-medium uppercase tracking-wider text-viewerlighttext">
                     Logos
                  </h2>
                  <p className="text-sm text-viewerlighttext">
                     Copy link or right-click to save.
                  </p>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
                     {logos.map((logo) => {
                        const isCopied = copiedId === logo.id;

                        return (
                           <div key={logo.id} className="flex w-full flex-col gap-2">
                              <div className="flex w-full items-center justify-center rounded-lg border border-viewerborder bg-white p-4 sm:min-h-[120px]">
                                 {logo.preview}
                              </div>
                              <span className="text-sm text-viewertext">{logo.name}</span>
                              <button
                                 type="button"
                                 onClick={() => copyValue(logo.id, logo.url)}
                                 className="flex min-h-[44px] cursor-pointer items-center justify-between gap-2 rounded-lg bg-[#eef0f4] px-2 py-2 font-mono text-xs text-viewertext hover:bg-[#e3e7ee] focus:outline-none"
                                 title="Copy link"
                              >
                                 <span className="min-w-0 truncate">{logo.url}</span>
                                 <span className="shrink-0 text-viewerlighttext">
                                    {isCopied ? "Copied" : "Copy"}
                                 </span>
                              </button>
                           </div>
                        );
                     })}
                  </div>
               </section>
            </div>
         </div>
      </div>
   );
};

export default BrandKit;
