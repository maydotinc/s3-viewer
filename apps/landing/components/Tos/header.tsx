import { Calendar } from "lucide-react";

const TosHeader = () => {
   return (
      <div className="w-full flex flex-col items-center gap-6 p-6 max-md:bg-viewergray max-md:border max-md:border-viewerborder max-md:rounded-lg max-md:gap-2">
         <div className="flex items-center px-3 py-2 border border-viewerborder bg-viewerwhite gap-1 rounded-lg">
            <Calendar className="size-4" />
            <span className="text-md max-md:text-xs">
               EFFECTIVE DATE: JULY 25TH, 2025
            </span>
         </div>
         <div className="flex flex-col items-center gap-2">
            <h1 className="text-6xl max-md:text-4xl font-semibold text-viewerblack">
               Terms & Conditions
            </h1>
            <h2 className="text-xl max-md:text-sm text-viewertext">
               Please read these terms carefully before using S3-Viewer services
            </h2>
         </div>
      </div>
   );
};

export default TosHeader;
