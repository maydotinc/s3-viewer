import { Button } from "@s3-viewer/ui/components/button";
import Image from "next/image";
import { FaGithub } from "react-icons/fa";
import BasicBlock from "../basic-block";

const IntroBlock = () => {
   return (
      <BasicBlock className="md:flex-row gap-0 max-md:py-5 max-md:border-b max-md:border-viewerborder">
         <div className="bg-viewergray flex-1 border border-viewerborder">
            <div className="flex flex-col justify-between h-full p-6 gap-6">
               <div className="flex cursor-default items-center gap-1.5 rounded-lg w-fit px-3 py-1 border border-viewerborder bg-viewerwhite">
                  <FaGithub className="size-4" />
                  <span className="text-md">1-Click Self-Host</span>
               </div>
               <h1 className="md:text-5xl text-4xl font-semibold text-viewerblack">
                  A Fast, Open-Source S3 Viewer That Just Works
               </h1>
               <h2 className="md:text-xl text-lg text-viewertext">
                  T3Chat but for Object Storage - it's time for web to be fast
                  again
               </h2>
               <Button
                  variant="secondary"
                  size="lg"
                  className="h-12 text-md w-fit"
                  asChild
               >
                  <a href="https://s3-viewer.com/dashboard" target="_blank">
                     Connect your server
                  </a>
               </Button>
            </div>
         </div>
         <div className="flex-1 bg-viewerblue bg-[url('/landing/grain-filter.svg')] bg-blend-multiply p-8 flex justify-center items-center">
            <Image
               src="/landing/bucketview.png"
               alt="Home Overview"
               width={600}
               height={500}
               quality={100}
               priority
               draggable={false}
               className="select-none"
            />
         </div>
      </BasicBlock>
   );
};

export default IntroBlock;
