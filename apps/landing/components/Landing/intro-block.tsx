import { Button } from "@s3-viewer/ui/components/button";
import Image from "next/image";
import Link from "next/link";
import { FaGithub } from "react-icons/fa";
import BasicBlock from "../basic-block";

const IntroBlock = () => {
   return (
      <BasicBlock className="md:flex-row gap-0 max-md:py-5 max-md:border-b max-md:border-viewerborder">
         <div className="bg-viewergray flex-1 border border-viewerborder">
            <div className="flex flex-col justify-center h-full p-6 gap-6">
               <div className="flex cursor-default items-center gap-1.5 rounded-lg w-fit px-3 py-1 border border-viewerborder bg-viewerwhite">
                  <FaGithub className="size-4" />
                  <span className="text-md">OPEN SOURCE</span>
               </div>
               <h1 className="md:text-[42px] text-4xl font-semibold text-viewerblack">
                  Explore S3-compatible Object Storage Online
               </h1>
               <h2 className="md:text-xl text-lg text-viewertext">
                  Manage all your buckets in one place, with a Google Drive like
                  interface that just works.
               </h2>
               <Button
                  variant="secondary"
                  size="lg"
                  className="h-12 text-md w-fit"
                  asChild
               >
                  <Link href="/dashboard">Connect your server</Link>
               </Button>
            </div>
         </div>
         <div className="flex-1 bg-viewerblue bg-[url('/landing/grain-filter.svg')] bg-blend-multiply p-8 flex justify-center items-center">
            <Image
               src="/landing/bucketview.png"
               alt="S3 Viewer dashboard showing buckets and object browser"
               width={4320}
               height={2700}
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
