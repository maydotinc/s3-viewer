import BasicBlock from "../basic-block";

const ToolsBlock = () => {
   return (
      <BasicBlock className="py-20">
         <div className="flex flex-col gap-2 items-center">
            <h1 className="text-4xl text-viewerblack font-semibold">
               Built with modern tools
            </h1>
            <h2 className="text-xl text-viewertext">
               Lorem Ipsum is simply dummy text of the printing and typesetting
               industry
            </h2>
         </div>
         <div className="bg-viewergray border border-viewerborder px-8 h-100 w-full" />
      </BasicBlock>
   );
};

export default ToolsBlock;
