import Image from "next/image";
import Link from "next/link";

const Footer = () => {
   return (
      <footer className="flex w-full justify-center items-center bg-viewerblue">
         <div className="flex w-full flex-wrap max-w-screen-2xl justify-between items-center gap-6 max-md:min-h-32 min-h-32 max-md:px-4 px-16 py-6">
            <Image
               src="/icons/whiteviewer.svg"
               alt="S3 Viewer"
               width={208}
               height={47}
               priority
               quality={100}
               draggable={false}
               className="select-none"
            />
            <div className="flex gap-4 text-viewerwhite text-sm">
               <Link href="/tos" className="underline">
                  Terms of Service
               </Link>
               <Link href="/privacy-policy" className="underline order-first">
                  Privacy Policy
               </Link>
            </div>
         </div>
      </footer>
   );
};

export default Footer;
