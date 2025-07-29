import { Button } from "@s3-viewer/ui/components/button";
import Image from "next/image";

const ExploreBlock = () => {
   return (
      <div className="relative -z-11 bg-viewergray w-full px-[120px] py-[60px] flex flex-col items-center gap-6">
         <div className="absolute inset-0 translate-y-1/5 -z-10 bg-[linear-gradient(to_top,transparent_0%,#f7f7f7),linear-gradient(to_right,#e1e4ea_1px,transparent_1px),linear-gradient(to_top,#e1e4ea_1px,transparent_1px)] bg-[size:100%_100%,60px_60px,60px_60px]" />
         <Image
            src="/icons/viewerblue.svg"
            alt="viewer-cube"
            width={104}
            height={105}
         />
         <div className="flex flex-col gap-2 items-center">
            <h1 className="text-4xl text-viewerblack font-semibold">
               Explore Awesome S3 - Viewer Experience
            </h1>
            <h2 className="text-xl text-viewertext">
               Lorem Ipsum is simply dummy text of the printing and typesetting
               industry
            </h2>
         </div>
         <Button
            asChild
            size="lg"
            className="h-12 text-md bg-viewerblack border-viewerblack text-viewerwhite hover:bg-viewerblack/80 rounded-xl"
         >
            <a href="https://github.com/maydotinc/s3-viewer" target="_blank">
               Open Viewer
            </a>
         </Button>
      </div>
   );
};

export default ExploreBlock;
