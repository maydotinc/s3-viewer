import Lottie from "lottie-react";
import objectsDemoAnimation from "../../public/landing/objectsdemo.json";
import serverConnectAnimation from "../../public/landing/serverconnect.json";
import serverSelectAnimation from "../../public/landing/serverselect.json";

const DemoBlock = () => {
   return (
      <>
         <div className="w-full px-[120px] py-[60px] flex flex-col gap-6">
            <div className="bg-viewergray flex-1 border border-viewerborder px-8 flex justify-between">
               <Lottie
                  animationData={objectsDemoAnimation}
                  loop
                  autoplay
                  style={{ width: "100%", height: "100%" }}
               />
            </div>
            <div className="flex flex-col gap-2">
               <h1 className="text-4xl text-viewerblack font-semibold">
                  S3 Viewer that works like a file browser
               </h1>
               <h2 className="text-xl text-viewertext">
                  Lorem Ipsum is simply dummy text of the printing and
                  typesetting industry
               </h2>
            </div>
         </div>
         <div className="w-full px-[120px] py-[60px] flex gap-6">
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
                  <h1 className="text-2xl text-viewerblack font-semibold">
                     One - Click Server Connect
                  </h1>
                  <h2 className="text-xl text-viewertext">
                     Lorem Ipsum is simply dummy text of the printing and
                     typesetting industry
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
                  <h1 className="text-2xl text-viewerblack font-semibold">
                     Switch between servers
                  </h1>
                  <h2 className="text-xl text-viewertext">
                     Lorem Ipsum is simply dummy text of the printing and
                     typesetting industry
                  </h2>
               </div>
            </div>
         </div>
      </>
   );
};

export default DemoBlock;
