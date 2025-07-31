import BasicBlock from "../basic-block";

const RepBlock = () => {
   return (
      <BasicBlock
         className="gap-15"
         wrapperbg={{
            className: "bg-viewergray",
         }}
      >
         <div className="flex flex-col gap-2 items-center">
            <h1 className="text-4xl text-viewerblue font-semibold">
               World-class developers use S3-Viewer
            </h1>
            <h2 className="text-xl text-viewertext">
               Trusted by industry-leading teams
            </h2>
         </div>
         <div className="flex justify-between">
            <span className="text-xl text-viewertext">Startups</span>
            <span className="text-xl text-viewertext">Enterprise Teams</span>
            <span className="text-xl text-viewertext">DevOps Engineers</span>
            <span className="text-xl text-viewertext">Cloud Architects</span>
         </div>
      </BasicBlock>
   );
};

export default RepBlock;
