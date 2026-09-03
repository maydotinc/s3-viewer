import { Spinner } from "@s3-viewer/ui/components/spinner";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useState } from "react";
import BasicBlock from "../basic-block";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

const LottieBox = ({
   animationData,
   className,
}: {
   animationData: object | null;
   className: string;
}) => (
   <div className={className}>
      {animationData ? (
         <Lottie
            animationData={animationData}
            loop
            autoplay
            className="motion-fade-in-fast object-contain size-full"
         />
      ) : (
         <div className="grid size-full place-items-center">
            <Spinner size="md" />
         </div>
      )}
   </div>
);

const useLottieData = (src: string) => {
   const [data, setData] = useState<object | null>(null);

   useEffect(() => {
      let cancelled = false;
      fetch(src)
         .then((res) => (res.ok ? res.json() : null))
         .then((json: object | null) => {
            if (!cancelled) setData(json);
         })
         .catch(() => {
            if (!cancelled) setData(null);
         });
      return () => {
         cancelled = true;
      };
   }, [src]);

   return data;
};

const DemoBlock = () => {
   const objectUpload = useLottieData("/landing/objectupload.json");
   const serverConnect = useLottieData("/landing/serverconnect.json");

   return (
      <>
         <BasicBlock className="max-md:border-b max-md:border-viewerborder">
            <div className="bg-viewergray flex-1 border border-viewerborder px-8 flex max-md:flex-col max-md:px-4 overflow-hidden relative">
               <div className="md:flex-1 max-md:w-full flex items-end justify-center relative md:pt-[5%]">
                  <Image
                     src="/landing/objectview.png"
                     alt="Browsing objects inside a bucket in S3 Viewer"
                     width={3064}
                     height={1561}
                     sizes="(max-width: 767px) 100vw, 45vw"
                     className="select-none object-contain translate-y-[8%] border rounded-xl h-auto w-full"
                     draggable={false}
                  />
               </div>
               <div className="select-none max-md:order-first md:flex-1 flex items-center justify-center relative max-md:items-start max-md:-my-[10%]">
                  <LottieBox
                     animationData={objectUpload}
                     className="w-full aspect-square md:absolute max-md:scale-[1.1]"
                  />
               </div>
            </div>
            <div className="flex flex-col items-start w-full gap-2">
               <h2 className="md:text-4xl text-3xl text-viewerblack font-semibold">
                  S3 Viewer that works like a file browser
               </h2>
               <p className="md:text-xl text-base text-viewertext">
                  Navigate your S3 buckets with the familiar file explorer
                  interface you already know and love
               </p>
            </div>
         </BasicBlock>
         <BasicBlock className="md:flex-row max-md:border-b max-md:border-viewerborder">
            <div className="flex-1 flex flex-col gap-6">
               <div className="w-full bg-viewergray flex-1 border border-viewerborder px-8 flex items-center justify-center">
                  <LottieBox
                     animationData={serverConnect}
                     className="w-full aspect-[4/3]"
                  />
               </div>
               <div className="flex flex-col gap-2">
                  <h2 className="md:text-3xl text-2xl text-viewerblack font-semibold">
                     Connect a server in one step
                  </h2>
                  <p className="md:text-xl text-sm text-viewertext">
                     Add any S3-compatible provider from the sidebar — enter the
                     region and endpoint once and your buckets appear
                  </p>
               </div>
            </div>
            <div className="flex-1 flex flex-col gap-6">
               <div className="w-full bg-viewergray flex-1 border border-viewerborder p-8 flex items-center justify-center">
                  <Image
                     src="/landing/serverselect.png"
                     alt="Server switcher"
                     width={756}
                     height={815}
                     sizes="(max-width: 767px) 90vw, 340px"
                     className="select-none max-h-[270px] w-auto object-contain"
                     draggable={false}
                  />
               </div>
               <div className="flex flex-col gap-2">
                  <h2 className="md:text-3xl text-2xl text-viewerblack font-semibold">
                     Switch between servers
                  </h2>
                  <p className="md:text-xl text-sm text-viewertext">
                     Manage multiple S3 providers seamlessly - AWS S3,
                     Cloudflare R2, MinIO, and more from one sidebar
                  </p>
               </div>
            </div>
         </BasicBlock>
      </>
   );
};

export default DemoBlock;
