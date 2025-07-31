import { GithubIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const Footer = () => {
   return (
      <footer className="flex  w-full justify-center items-center bg-viewerblue">
         <div className="flex w-full flex-wrap max-w-screen-2xl justify-between items-center gap-6 max-md:min-h-40 min-h-60 max-md:px-4 px-16 py-6">
            <Image
               src="/icons/whiteviewer.svg"
               alt="S3 Viewer"
               width={208}
               height={47}
               priority
               quality={100}
            />
            <div className="flex gap-4 text-viewerwhite text-sm">
               <a
                  href="https://github.com/maydotinc/s3-viewer"
                  target="_blank"
                  className="flex items-center gap-1 order-last"
               >
                  <GithubIcon className="size-5" /> Github
               </a>
               <Link href="/tos" className="underline">
                  Terms of Service
               </Link>
               <Link href="/" className="underline order-first">
                  Privacy Policy
               </Link>
            </div>
         </div>
      </footer>
   );
};

export default Footer;
