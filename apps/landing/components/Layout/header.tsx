import { cn } from "@s3-viewer/ui/lib/utils";
import { Button } from "@s3-viewer/ui/components/button";
import { ChevronRight, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FaGithub } from "react-icons/fa";

const Header = () => {
   const [scrolled, setScrolled] = useState(false);

   useEffect(() => {
      const onScroll = () => setScrolled(window.scrollY > 4);
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => window.removeEventListener("scroll", onScroll);
   }, []);

   return (
      <header
         className={cn(
            "sticky top-0 z-50 flex w-full items-center justify-center border-b transition-[border-color,background-color] duration-200",
            scrolled
               ? "border-viewerborder bg-viewerwhite/85 backdrop-blur-md"
               : "border-transparent bg-viewerwhite"
         )}
      >
         <div className="flex w-full max-w-screen-2xl items-center justify-between gap-4 py-5 px-30 max-xl:px-15 max-md:px-4">
            <Link
               href="/"
               draggable={false}
               className="flex items-center"
               aria-label="S3 Viewer home"
            >
               <Image
                  src="/icons/viewer.svg"
                  alt="S3 Viewer"
                  width={160}
                  height={38}
                  style={{ height: "auto" }}
                  priority
                  quality={100}
                  draggable={false}
               />
            </Link>

            <div className="flex items-center gap-2">
               <Link
                  href="https://github.com/maydotinc/s3-viewer"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Star S3 Viewer on GitHub"
                  className="hidden sm:flex h-10 items-center rounded-md border border-viewerborder bg-viewerwhite hover:bg-viewergray transition-colors overflow-hidden"
               >
                  <span className="flex items-center gap-2 px-3 h-full text-[13px] font-medium text-viewerblack">
                     <FaGithub className="size-4" />
                     Star
                  </span>
                  <span className="flex items-center gap-1 px-3 h-full border-l border-viewerborder bg-viewergray text-[12.5px] font-semibold text-viewertext">
                     <Star
                        className="size-3.5 text-viewerlighttext"
                        strokeWidth={2}
                     />
                     <span>GitHub</span>
                  </span>
               </Link>

               <Link
                  href="https://github.com/maydotinc/s3-viewer"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Star S3 Viewer on GitHub"
                  className="sm:hidden grid place-items-center size-10 rounded-md border border-viewerborder bg-viewerwhite text-viewerblack"
               >
                  <FaGithub className="size-4" />
               </Link>

               <Button
                  size="lg"
                  variant="secondary"
                  className="h-10 text-[13.5px]"
                  asChild
               >
                  <Link href="/dashboard">
                     Open Viewer
                     <ChevronRight className="size-4" />
                  </Link>
               </Button>
            </div>
         </div>
      </header>
   );
};

export default Header;
