import { Spinner } from "@s3-viewer/ui/components/spinner";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useState } from "react";
import BasicBlock, { SectionHeading } from "../basic-block";

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
            className="size-full object-contain"
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
   const serverConnect = useLottieData("/landing/serverconnect.json");

   return (
      <BasicBlock sectionClassName="border-y border-viewerborder bg-viewergray">
         <SectionHeading
            eyebrow="Product"
            title="An S3 client that works like a file browser"
            description="Navigate your buckets with the familiar file explorer interface you already know — folders, search, drag and drop."
         />

         <div className="mt-10 overflow-hidden rounded-xl border border-viewerborder bg-viewerwhite shadow-sm">
            <Image
               src="/landing/objectview.png"
               alt="Browsing objects inside a bucket in S3 Viewer"
               width={3064}
               height={1561}
               sizes="(max-width: 1152px) 100vw, 1104px"
               draggable={false}
               className="h-auto w-full select-none"
            />
         </div>

         <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-5 rounded-xl border border-viewerborder bg-viewerwhite p-6">
               <div className="grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-lg bg-viewergray">
                  <LottieBox
                     animationData={serverConnect}
                     className="size-full"
                  />
               </div>
               <div className="flex flex-col gap-1.5">
                  <h3 className="text-lg font-semibold tracking-tight text-viewerblack">
                     Connect a server in one step
                  </h3>
                  <p className="text-sm text-viewertext">
                     Add any S3-compatible provider from the sidebar — enter the
                     region and endpoint once and your buckets appear.
                  </p>
               </div>
            </div>

            <div className="flex flex-col gap-5 rounded-xl border border-viewerborder bg-viewerwhite p-6">
               <div className="grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-lg bg-viewergray p-6">
                  <Image
                     src="/landing/serverselect.png"
                     alt="The server switcher in the S3 Viewer sidebar"
                     width={756}
                     height={815}
                     sizes="(max-width: 767px) 80vw, 320px"
                     draggable={false}
                     className="h-full w-auto max-w-full object-contain select-none"
                  />
               </div>
               <div className="flex flex-col gap-1.5">
                  <h3 className="text-lg font-semibold tracking-tight text-viewerblack">
                     Switch between servers
                  </h3>
                  <p className="text-sm text-viewertext">
                     Manage AWS S3, Cloudflare R2, MinIO and more from one
                     sidebar, without changing tabs.
                  </p>
               </div>
            </div>
         </div>
      </BasicBlock>
   );
};

export default DemoBlock;
