import objectUploadAnimation from "@/public/landing/objectupload.json";
import serverConnectAnimation from "@/public/landing/serverconnect.json";
import Lottie from "lottie-react";
import Image from "next/image";
import BasicBlock from "../basic-block";

const DemoBlock = () => {
   return (
      <>
         <BasicBlock className="max-md:border-b max-md:border-viewerborder">
            <div className="bg-viewergray flex-1 border border-viewerborder px-8 flex max-md:flex-col max-md:px-4 overflow-hidden relative">
               <div className="md:flex-1 max-md:w-full flex items-end justify-center relative md:pt-[5%]">
                  <Image
                     src="/landing/objectview.png"
                     alt="Object View"
                     width={3064}
                     height={1561}
                     className="select-none object-contain translate-y-[8%] border rounded-xl"
                     draggable={false}
                  />
               </div>
               <div className="select-none max-md:order-first md:flex-1 flex items-center justify-center relative max-md:items-start max-md:-my-[10%]">
                  <Lottie
                     animationData={objectUploadAnimation}
                     loop
                     autoplay
                     alt="Object Upload Animation"
                     className="object-contain md:absolute max-md:scale-[1.1]"
                  />
               </div>
            </div>
            <div className="flex flex-col items-start w-full gap-2">
               <h1 className="md:text-4xl text-3xl text-viewerblack font-semibold">
                  S3 Viewer that works like a file browser
               </h1>
               <h2 className="md:text-xl text-base text-viewertext">
                  Navigate your S3 buckets with the familiar file explorer
                  interface you already know and love
               </h2>
            </div>
         </BasicBlock>
         <BasicBlock className="md:flex-row max-md:border-b max-md:border-viewerborder">
            <div className="flex-1 flex flex-col gap-6">
               <div className="w-full bg-viewergray flex-1 border border-viewerborder px-8 flex items-center justify-center">
                  <Lottie
                     animationData={serverConnectAnimation}
                     loop
                     autoplay
                     className="object-contain size-full"
                  />
               </div>
               <div className="flex flex-col gap-2">
                  <h1 className="md:text-3xl text-2xl text-viewerblack font-semibold">
                     One - Click Server Connect
                  </h1>
                  <h2 className="md:text-xl text-sm text-viewertext">
                     Connect to any S3-compatible storage provider instantly
                     with auto-detection and secure credential management
                  </h2>
               </div>
            </div>
            <div className="flex-1 flex flex-col gap-6">
               <div className="w-full bg-viewergray flex-1 border border-viewerborder p-8 flex items-center justify-center">
                  <Image
                     src="/landing/serverselect.png"
                     alt="Object View"
                     width={756}
                     height={815}
                     className="select-none max-h-[270px] object-contain"
                     draggable={false}
                  />
               </div>
               <div className="flex flex-col gap-2">
                  <h1 className="md:text-3xl text-2xl text-viewerblack font-semibold">
                     Switch between servers
                  </h1>
                  <h2 className="md:text-xl text-sm text-viewertext">
                     Manage multiple S3 providers seamlessly - AWS S3,
                     Cloudflare R2, MinIO, and more from one dashboard
                  </h2>
               </div>
            </div>
         </BasicBlock>
      </>
   );
};

export default DemoBlock;
