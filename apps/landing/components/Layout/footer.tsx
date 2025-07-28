import {
   Facebook,
   GithubIcon,
   Instagram,
   Linkedin,
   Twitter,
   Youtube,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const Footer = () => {
   return (
      <div className="flex h-[273px] w-full flex-col items-center bottom-0">
         <div className="flex-1 flex items-center justify-between bg-viewerblue w-full px-[64px]">
            <Image
               src="/icons/whiteviewer.svg"
               alt="S3 Viewer"
               width={208}
               height={47}
               priority
               quality={100}
            />
            <a
               href="https://github.com/maydotinc/s3-viewer"
               target="_blank"
               className="flex items-center gap-1 text-viewerwhite"
            >
               <GithubIcon className="size-5" /> Github
            </a>
            <div className="flex flex-col items-start gap-1 text-viewerwhite">
               <Link href="/tos" className="text-md underline">
                  Terms of Service
               </Link>
               <Link href="/" className="text-md underline">
                  Privacy Policy
               </Link>
            </div>
            <div className="flex items-center gap-2 text-viewerwhite">
               <a href="/" className="text-md">
                  <Facebook className="size-5" />
               </a>
               <a href="/" className="text-md">
                  <Instagram className="size-5" />
               </a>
               <a href="/" className="text-md">
                  <Twitter className="size-5" />
               </a>
               <a href="/" className="text-md">
                  <Linkedin className="size-5" />
               </a>
               <a href="/" className="text-md">
                  <Youtube className="size-5" />
               </a>
            </div>
         </div>
         <div className="h-[31px] w-full bg-viewerdarkblue" />
      </div>
   );
};

export default Footer;
