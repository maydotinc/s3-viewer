import { BuiltByMay } from "@/components/built-by-may";
import CtaButtons from "@/components/cta-buttons";
import { APP_PATH } from "@/lib/site-config";
import { AppHeroFigure } from "./figures/app-hero";

const IntroBlock = () => {
   return (
      <section className="w-full">
         <div className="mx-auto w-full max-w-6xl px-6 pt-16 pb-16 sm:pt-28 2xl:max-w-7xl">
            <div className="flex flex-col items-center text-center">
               <BuiltByMay />

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
