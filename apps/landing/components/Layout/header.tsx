import { Button } from "@s3-viewer/ui/components/button";
import { ChevronRight, GithubIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const Header = () => {
   return (
      <div className="flex justify-between w-full items-center h-[111px] top-0 bg-viewergray border-b border-viewerborder px-[120px]">
         <div className="flex items-center gap-2">
            <Link href="/">
               <Image
                  src="/icons/viewer.svg"
                  alt="S3 Viewer"
                  width={190}
                  height={46}
                  priority
                  quality={100}
               />
            </Link>
         </div>
         <div className="flex items-center gap-2">
            <Button size="lg" className="h-12 text-md" asChild>
               <a href="https://github.com/maydotinc/s3-viewer" target="_blank">
                  <GithubIcon className="size-5" /> Github
                  <ChevronRight className="size-5" />
               </a>
            </Button>
            <Button
               variant="secondary"
               size="lg"
               className="h-12 text-md"
               asChild
            >
               <a href="https://github.com/maydotinc/s3-viewer" target="_blank">
                  Go To Dashboard <ChevronRight className="size-5" />
               </a>
            </Button>
         </div>
      </div>
   );
};

export default Header;
