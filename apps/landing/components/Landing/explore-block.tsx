import { Button } from "@s3-viewer/ui/components/button";
import Image from "next/image";
import Link from "next/link";
import BasicBlock from "../basic-block";

const WrapperBg = () => {
   return (
      <div className="absolute bottom-0 inset-x-0 h-3/5 -z-1 bg-[linear-gradient(to_top,transparent_0%,#f7f7f7),linear-gradient(to_right,#e1e4ea_1px,transparent_1px),linear-gradient(to_top,#e1e4ea_1px,transparent_1px)] bg-[size:100%_100%,60px_60px,60px_60px]" />
   );
};

const ExploreBlock = () => {
   return (
      <BasicBlock
         wrapperbg={{
            className: "bg-viewergray z-1 relative",
            component: <WrapperBg />,
         }}
      >
         <div className="flex flex-col gap-6 items-center">
            <div className="select-none max-md:size-18">
               <Image
                  src="/icons/viewerblue.svg"
                  alt="viewer-cube"
                  width={104}
                  height={105}
                  draggable={false}
                  className="select-none"
               />
            </div>
            <div className="flex flex-col gap-2 items-center">
               <h1 className="md:text-4xl text-3xl text-viewerblack font-semibold text-center">
                  Explore Awesome S3 - Viewer Experience
               </h1>
               <h2 className="md:text-xl text-base text-viewertext text-center">
                  Experience the future of object storage management with our
                  intuitive, fast, and secure S3 browser
               </h2>
            </div>
            <Button
               asChild
               size="lg"
               className="h-12 w-fit text-md bg-viewerblack border-viewerblack text-viewerwhite hover:bg-viewerblack/80 rounded-xl"
            >
               <Link href="https://s3-viewer.com/dashboard" target="_blank">
                  Open Viewer
               </Link>
            </Button>
         </div>
      </BasicBlock>
   );
};

export default ExploreBlock;
