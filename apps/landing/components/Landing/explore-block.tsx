import { GITHUB_URL } from "@/lib/site-config";
import { Button } from "@s3-viewer/ui/components/button";
import Image from "next/image";
import Link from "next/link";
import { FaGithub } from "react-icons/fa";
import BasicBlock from "../basic-block";

const ExploreBlock = () => {
   return (
      <BasicBlock sectionClassName="border-t border-viewerborder bg-viewergray">
         <div className="flex flex-col items-center gap-6 text-center">
            <Image
               src="/icons/viewerblue.svg"
               alt=""
               width={104}
               height={105}
               draggable={false}
               className="size-12 select-none"
            />

            <div className="flex flex-col gap-3">
               <h2 className="text-3xl font-semibold tracking-tight text-balance text-viewerblack">
                  Explore the S3 Viewer experience
               </h2>
               <p className="mx-auto max-w-xl text-viewertext">
                  Browse, upload, share and manage files in any S3-compatible
                  bucket from one fast, open-source interface.
               </p>
            </div>

            <div className="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
               <Button
                  asChild
                  size="lg"
                  className="h-11 w-full px-6 text-[15px] sm:w-auto"
               >
                  <Link href="/dashboard">Open app</Link>
               </Button>
               <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-11 w-full px-6 text-[15px] sm:w-auto"
               >
                  <Link href={GITHUB_URL} target="_blank" rel="noreferrer">
                     <FaGithub />
                     Star on GitHub
                  </Link>
               </Button>
            </div>
         </div>
      </BasicBlock>
   );
};

export default ExploreBlock;
