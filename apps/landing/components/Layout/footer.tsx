import Image from "next/image";
import Link from "next/link";

const Footer = () => {
   return (
      <footer className="flex w-full flex-col justify-center items-center bg-viewerblue">
         <div className="flex w-full flex-wrap max-w-screen-2xl justify-between items-center gap-6 max-md:px-4 px-16 py-6">
            <Link
               href="/"
               draggable={false}
               className="h-full max-md:w-36 flex items-center"
            >
               <Image
                  src="/icons/whiteviewer.svg"
                  alt="S3 Viewer"
                  width={208}
                  height={47}
                  priority
                  quality={100}
                  draggable={false}
                  className="select-none h-10"
               />
            </Link>
            <div className="flex gap-4 text-viewerwhite text-sm">
               <Link href="/tos" className="underline">
                  Terms of Service
               </Link>
               <Link href="/privacy-policy" className="underline order-first">
                  Privacy Policy
               </Link>
               <Link href="/brand-kit" className="underline"> Brand Kit</Link>
            </div>
         </div>

         <div className="w-full bg-[#003539] py-4 flex flex-row items-center justify-center gap-2 text-white text-sm">
            Built by
            <img
               src="https://cdn-may.com/assets/may-square-512x512.png"
               alt="May Inc. Logo"
               width={24}
               height={24}
               className="w-5 h-5 object-contain select-none"
               draggable={false}
            />
            <Link
               href="https://may.inc"
               className="text-white hover:text-white/90 transition-colors"
            >
               May Inc.
            </Link>
         </div>
      </footer>
   );
};

export default Footer;
