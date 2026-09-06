import { GITHUB_URL } from "@/lib/site-config";
import { AppHeroFigure } from "./figures/app-hero";
import { Button } from "@s3-viewer/ui/components/button";
import Link from "next/link";
import { FaGithub } from "react-icons/fa";

const IntroBlock = () => {
   return (
      <section className="w-full">
         <div className="mx-auto w-full max-w-6xl px-6 pt-24 pb-16">
            <div className="flex flex-col items-center text-center">
               <span className="inline-flex h-7 items-center rounded-full border border-viewerborder bg-viewergray px-3 text-xs font-medium text-viewertext">
                  Open source · Self-hostable
               </span>

               <h1 className="mt-6 max-w-3xl text-4xl leading-[1.05] font-semibold tracking-tight text-balance text-viewerblack sm:text-5xl md:text-6xl">
                  Browse every{" "}
                  <span className="whitespace-nowrap">S3-compatible</span>{" "}
                  bucket in one place
               </h1>

               <p className="mt-5 max-w-xl text-lg text-viewertext">
                  One fast interface for AWS S3, Cloudflare R2, MinIO and the
                  rest — with the file browser you already know.
               </p>

               <div className="mt-8 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
                  <Button
                     asChild
                     size="lg"
                     className="h-11 w-full px-6 text-[15px] sm:w-auto"
                  >
                     <Link href="/dashboard">Connect your server</Link>
                  </Button>
                  <Button
                     asChild
                     variant="outline"
                     size="lg"
                     className="h-11 w-full px-6 text-[15px] sm:w-auto"
                  >
                     <Link href={GITHUB_URL} target="_blank" rel="noreferrer">
                        <FaGithub />
                        Star on GitHub
                     </Link>
                  </Button>
               </div>
            </div>

            <div className="mx-auto mt-16 w-full max-w-5xl overflow-hidden rounded-xl border border-viewerborder bg-viewerwhite shadow-sm">
               <AppHeroFigure />
            </div>
         </div>
      </section>
   );
};

export default IntroBlock;
