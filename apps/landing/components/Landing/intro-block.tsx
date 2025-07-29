import { Button } from "@s3-viewer/ui/components/button";
import { Github } from "lucide-react";
import Image from "next/image";

const IntroBlock = () => {
   return (
      <div className="w-full px-[120px] py-[60px] flex">
         <div className="bg-viewergray flex-1 border border-viewerborder">
            <div className="flex flex-col justify-between h-full p-6 gap-6">
               <a
                  href="https://github.com/maydotinc/s3-viewer"
                  target="_blank"
                  className="flex items-center gap-1 rounded-lg w-fit px-3 py-1 border border-viewerborder bg-viewerwhite"
               >
                  <Github className="size-4" />
                  <span className="text-md">OPEN SOURCE</span>
               </a>
               <h1 className="text-5xl font-semibold text-viewerblack">
                  A Fast, Open-Source S3 Viewer That Just Works
               </h1>
               <h2 className="text-xl text-viewertext">
                  T3Chat but for Object Storage - it's time for web to be fast
                  again
               </h2>
               <Button
                  variant="secondary"
                  size="lg"
                  className="h-12 text-md w-fit"
                  asChild
               >
                  <a
                     href="https://github.com/maydotinc/s3-viewer"
                     target="_blank"
                  >
                     Connect your server
                  </a>
               </Button>
            </div>
         </div>
         <div className="flex-1 bg-viewerblue bg-[url('/landing/grain-filter.svg')] bg-blend-multiply p-8 flex justify-center items-center">
            <Image
               src="/landing/bucketview.png"
               alt="Intro Block"
               width={600}
               height={500}
            />
         </div>
      </div>
   );
};

export default IntroBlock;
