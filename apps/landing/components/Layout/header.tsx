import { Button } from "@s3-viewer/ui/components/button";
import { ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const Header = () => {
   return (
      <header className="flex w-full items-center justify-center bg-viewergray border-b border-viewerborder sticky top-0 z-50">
         <div className="flex w-full max-w-screen-2xl justify-between items-center h-20 px-30 max-xl:px-15 max-md:px-4">
            <div className="flex items-center select-none max-md:w-36">
               <Link href="/" draggable={false}>
                  <Image
                     src="/icons/viewer.svg"
                     alt="S3 Viewer"
                     width={190}
                     height={46}
                     priority
                     quality={100}
                     draggable={false}
                  />
               </Link>
            </div>
            <Button
               size="lg"
               variant="secondary"
               className="h-12 text-md md:hidden"
               asChild
            >
               <Link href="https://s3-viewer.com/dashboard" target="_blank">
                  <ChevronRight className="size-5" />
               </Link>
            </Button>

            <div className="flex items-center gap-2 max-md:hidden">
               <Button
                  variant="secondary"
                  size="lg"
                  className="h-12 text-md"
                  asChild
               >
                  <Link href="https://s3-viewer.com/dashboard" target="_blank">
                     Open Viewer <ChevronRight className="size-5" />
                  </Link>
               </Button>
            </div>
         </div>
      </header>
   );
};

export default Header;
