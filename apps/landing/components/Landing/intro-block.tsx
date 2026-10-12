import CtaButtons from "@/components/cta-buttons";
import { ExternalLink } from "@/components/external-link";
import {
   APP_PATH,
   MAY_NAME,
   MAY_ROUNDED_LOGO_URL,
   MAY_URL,
} from "@/lib/site-config";
import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import { AppHeroFigure } from "./figures/app-hero";

const IntroBlock = () => {
   return (
      <section className="w-full">
         <div className="mx-auto w-full max-w-6xl px-6 pt-14 pb-16 sm:pt-24 2xl:max-w-7xl">
            <div className="flex flex-col items-center text-center">
               <ExternalLink
                  href={MAY_URL}
                  className="group inline-flex h-7 items-center gap-1.5 rounded-full border border-viewerborder bg-viewergray pr-2.5 pl-1.5 text-xs font-medium text-viewertext transition-colors hover:border-viewerblack/20 hover:bg-viewerwhite hover:text-viewerblack"
               >
                  <Image
                     src={MAY_ROUNDED_LOGO_URL}
                     alt=""
                     width={16}
                     height={16}
                     className="size-4 rounded-[4px]"
                     draggable={false}
                  />
                  <span>Built by {MAY_NAME}</span>
                  <ArrowUpRight
                     className="size-3.5 text-viewerlighttext transition-colors group-hover:text-viewerblack"
                     aria-hidden
                  />
               </ExternalLink>

               <h1 className="mt-6 max-w-3xl text-4xl leading-[1.05] font-semibold tracking-tight text-balance text-viewerblack sm:text-5xl md:text-6xl">
                  Browse every{" "}
                  <span className="whitespace-nowrap">S3-compatible</span>{" "}
                  bucket in one place
               </h1>

               <p className="mt-5 max-w-xl text-lg text-viewertext">
                  One fast interface for AWS S3, Cloudflare R2, MinIO and the
                  rest — with the file browser you already know.
               </p>

               <CtaButtons
                  primary={{ href: APP_PATH, label: "Connect your server" }}
                  className="mt-8"
               />
            </div>

            <div className="mx-auto mt-12 w-full max-w-5xl overflow-hidden rounded-xl border border-viewerborder bg-viewerwhite shadow-sm sm:mt-16 2xl:max-w-6xl">
               <AppHeroFigure />
            </div>
         </div>
      </section>
   );
};

export default IntroBlock;
