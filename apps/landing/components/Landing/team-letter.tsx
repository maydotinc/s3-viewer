import Image from "next/image";
import BasicBlock from "../basic-block";

const TeamLetter = () => {
   return (
      <BasicBlock className="px-50 py-28">
         <div className="flex flex-1 items-center justify-center border-4 border-viewerblue/10 p-4 relative rounded-sm">
            <div className="absolute bottom-0 left-0 size-2 bg-viewerwhite -translate-x-1/2 translate-y-1/2" />
            <div className="absolute top-0 right-0 size-2 bg-viewerwhite translate-x-1/2 -translate-y-1/2" />
            <div className="flex flex-col size-full bg-viewergray border border-viewerborder p-6 gap-2 relative">
               <Image
                  src="/icons/viewercubegray.svg"
                  alt="viewer-cube"
                  width={63}
                  height={78}
                  className="absolute top-0 right-0 -translate-x-1/2 translate-y-1/2"
               />
               <Image
                  src="/icons/builtbymay.svg"
                  alt="viewer-logo"
                  width={150}
                  height={150}
                  className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2"
               />
               <span className="text-xs text-viewertext">A LETTER</span>
               <h1 className="text-3xl text-viewerblue font-semibold">
                  From the team
               </h1>
               <p className="text-base text-viewertext max-w-1/2">
                  Lorem Ipsum is simply dummy text of the printing and
                  typesetting industry. Lorem Ipsum has been the industry's
                  standard dummy text ever since the 1500s, when an unknown
                  printer took a galley of type and scrambled it to make a type
                  specimen book. It has survived not only five centuries
               </p>
               <div className="h-[1px] w-1/4 bg-viewerborder my-2" />
               <span className="text-base text-viewertext max-w-1/2">
                  but also the leap into electronic typesetting, remaining
                  essentially unchanged.
               </span>
               <div className="flex flex-col gap-2 mt-5">
                  <div className="flex items-center -space-x-2">
                     <Image
                        src="/landing/profiles/aleem.png"
                        alt="viewer-cube"
                        width={40}
                        height={40}
                        className="border border-viewerwhite rounded-full"
                        quality={100}
                     />
                     <Image
                        src="/landing/profiles/mike.png"
                        alt="viewer-cube"
                        width={40}
                        height={40}
                        className="border border-viewerwhite rounded-full"
                        quality={100}
                     />
                     <Image
                        src="/landing/profiles/vinit.png"
                        alt="viewer-cube"
                        width={40}
                        height={40}
                        className="border border-viewerwhite rounded-full"
                        quality={100}
                     />
                  </div>
                  <h3 className="text-base leading-none font-semibold text-viewerblack">
                     S3 - Viewer
                  </h3>
                  <span className="text-xs leading-none text-viewertext">
                     Aleem, Mike, Vinit
                  </span>
               </div>
            </div>
         </div>
      </BasicBlock>
   );
};

export default TeamLetter;
