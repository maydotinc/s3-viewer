import Image from "next/image";
import BasicBlock from "../basic-block";

const ToolsBlock = () => {
   return (
      <BasicBlock className="py-20">
         <div className="flex flex-col gap-2 items-center">
            <h2 className="md:text-5xl text-3xl text-viewerblack font-semibold text-center">
               Built with modern tools
            </h2>
            <p className="md:text-xl text-base text-viewertext text-center">
               Powered by Next.js, TypeScript, and modern web technologies for
               optimal performance and developer experience
            </p>
         </div>
         <div className="bg-viewergray border border-viewerborder md:py-4 md:px-8 p-6 w-full flex justify-center items-center">
            <Image
               src="/landing/tools.svg"
               alt="Next.js, TypeScript, React and the other tools S3 Viewer is built with"
               width={953}
               height={393}
               sizes="(max-width: 767px) 100vw, 900px"
               draggable={false}
               className="select-none"
            />
         </div>
      </BasicBlock>
   );
};

export default ToolsBlock;
