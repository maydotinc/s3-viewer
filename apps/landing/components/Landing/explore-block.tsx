import Image from "next/image";
import BasicBlock, { SectionTitle } from "../basic-block";
import CtaButtons from "@/components/cta-buttons";

const ExploreBlock = () => {
   return (
      <BasicBlock sectionClassName="border-t border-viewerborder bg-viewergray">
         <div className="flex flex-col items-center gap-6 text-center">
            <Image
               src="/landing/icons/viewerblue.svg"
               alt=""
               width={104}
               height={105}
               draggable={false}
               className="size-12 select-none"
            />

            <div className="flex flex-col gap-3">
               <SectionTitle className="text-balance">
                  Explore the S3 Viewer experience
               </SectionTitle>
               <p className="mx-auto max-w-xl text-viewertext">
                  Browse, upload, share and manage files in any S3-compatible
                  bucket from one fast, open-source interface.
               </p>
            </div>

            <CtaButtons />
         </div>
      </BasicBlock>
   );
};

export default ExploreBlock;
