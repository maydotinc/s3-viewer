import { GITHUB_URL } from "@/lib/site-config";
import { Button } from "@s3-viewer/ui/components/button";
import { ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { FaGithub } from "react-icons/fa";

const Header = () => {
   return (
      <header className="sticky top-0 z-50 h-16 w-full flex-none border-b border-viewerborder bg-viewerwhite">
         <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-between gap-4 px-6">
            <Link
               href="/"
               draggable={false}
               className="flex items-center"
               aria-label="S3 Viewer home"
            >
               <Image
                  src="/icons/viewer.svg"
                  alt="S3 Viewer"
                  width={150}
                  height={32}
                  className="h-7 w-auto shrink-0 select-none"
                  priority
                  quality={100}
                  draggable={false}
               />
            </Link>

            <div className="flex items-center gap-2">
               {/* Below `sm` there is no room for both at 320px, and the
                   hero and footer both carry a GitHub link. */}
               <Button variant="ghost" asChild className="max-sm:hidden">
                  <Link href={GITHUB_URL} target="_blank" rel="noreferrer">
                     <FaGithub />
                     GitHub
                  </Link>
               </Button>

               <Button asChild>
                  <Link href="/dashboard">
                     Open app
                     <ChevronRight />
                  </Link>
               </Button>
            </div>
         </div>
      </header>
   );
};

export default Header;
