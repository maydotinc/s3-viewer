import Image from "next/image";
import BasicBlock, { SectionHeading } from "../basic-block";

const ToolsBlock = () => {
   return (
      <BasicBlock>
         <SectionHeading
            eyebrow="Under the hood"
            title="Built with modern tools"
            description="Next.js, TypeScript and React — a thin client that stays fast as your buckets grow."
         />

         <div className="mt-10 flex w-full items-center justify-center rounded-xl border border-viewerborder bg-viewergray p-6 sm:p-10">
            <Image
               src="/landing/tools.svg"
               alt="Next.js, TypeScript, React and the other tools S3 Viewer is built with"
               width={953}
               height={393}
               sizes="(max-width: 1023px) 90vw, 900px"
               draggable={false}
               className="h-auto w-full max-w-[900px] select-none"
            />
         </div>
      </BasicBlock>
   );
};

export default ToolsBlock;
