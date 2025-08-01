import BasicBlock from "../basic-block";

const RepBlock = () => {
   return (
      <BasicBlock
         className="md:gap-15 gap-7 items-center overflow-x-hidden"
         wrapperbg={{
            className: "bg-viewergray",
         }}
      >
         <div className="flex flex-col gap-2 items-center">
            <h1 className="md:text-4xl text-3xl text-viewerblue font-semibold text-center">
               World-class developers use S3-Viewer
            </h1>
            <h2 className="md:text-xl text-base text-viewertext text-center">
               Trusted by industry-leading teams
            </h2>
         </div>
         <div className="flex justify-between w-full overflow-hidden gap-4">
            <span className="md:text-xl text-base text-viewertext">
               Startups
            </span>
            <span className="md:text-xl text-base text-viewertext">
               Enterprise Teams
            </span>
            <span className="md:text-xl text-base text-viewertext">
               DevOps Engineers
            </span>
            <span className="md:text-xl text-base text-viewertext">
               Cloud Architects
            </span>
         </div>
      </BasicBlock>
   );
};

export default RepBlock;
