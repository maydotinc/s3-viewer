import Image from "next/image";
import BasicBlock from "../basic-block";

const TeamLetter = () => {
   return (
      <BasicBlock className="px-50 py-28">
         <div className="flex flex-1 items-center justify-center border-4 border-viewerblue/10 md:p-4 p-1 relative rounded-sm">
            <div className="absolute bottom-0 left-0 size-2 bg-viewerwhite -translate-x-1/2 translate-y-1/2" />
            <div className="absolute top-0 right-0 size-2 bg-viewerwhite translate-x-1/2 -translate-y-1/2" />
            <div className="flex flex-col size-full bg-viewergray border border-viewerborder p-6 gap-4 relative">
               <div className="absolute bottom-0 right-0 md:translate-x-1/2 md:translate-y-1/2 max-md:size-25 max-xl:size-30 select-none">
                  <Image
                     src="/icons/builtbymay.svg"
                     alt="viewer-logo"
                     width={150}
                     height={150}
                     draggable={false}
                  />
               </div>
               <span className="text-xs text-viewertext">A LETTER</span>
               <h1 className="text-3xl text-viewerblue font-semibold">
                  From the team
               </h1>
               <p className="text-base text-viewertext md:max-w-1/2">
                  We built S3-Viewer because we were frustrated with the
                  complexity of existing object storage interfaces. Managing
                  data across different S3 providers shouldn't require learning
                  new tools or switching between multiple dashboards. We wanted
                  something that just works - intuitive, fast, and reliable.
               </p>
               <div className="h-[1px] w-1/4 bg-viewerborder my-2 max-md:hidden" />
               <span className="text-base text-viewertext md:max-w-1/2">
                  Our mission is to make object storage as accessible as your
                  local file system, regardless of your technical background.
               </span>
               <div className="md:absolute md:top-0 max-md:size-10 md:right-0 md:-translate-x-1/2 md:translate-y-1/2 select-none">
                  <Image
                     src="/icons/viewercubegray.svg"
                     alt="viewer-cube"
                     width={63}
                     height={78}
                     draggable={false}
                  />
               </div>
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
