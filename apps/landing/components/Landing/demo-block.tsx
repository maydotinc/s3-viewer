import Lottie from "lottie-react";
import objectUploadAnimation from "../../public/landing/objectupload.json";
import serverConnectAnimation from "../../public/landing/serverconnect.json";
import serverSelectAnimation from "../../public/landing/serverselect.json";
import BasicBlock from "../basic-block";

const DemoBlock = () => {
   return (
      <>
         <BasicBlock className="max-md:border-b max-md:border-viewerborder">
            <div className="bg-viewergray flex-1 border border-viewerborder px-8 flex">
               <Lottie
                  animationData={objectUploadAnimation}
                  loop
                  autoplay
                  style={{ width: "100%", height: "100%" }}
               />
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
               <div className="w-full bg-viewergray flex-1 border border-viewerborder px-8">
                  <Lottie
                     animationData={serverConnectAnimation}
                     loop
                     autoplay
                     style={{ width: "100%", height: "100%" }}
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
               <div className="w-full bg-viewergray flex-1 border border-viewerborder px-8">
                  <Lottie
                     animationData={serverSelectAnimation}
                     loop
                     autoplay
                     style={{ width: "100%", height: "100%" }}
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
