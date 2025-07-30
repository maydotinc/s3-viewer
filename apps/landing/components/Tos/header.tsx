import { Calendar } from "lucide-react";

const TosHeader = () => {
   return (
      <div className="w-full border border-viewerborder flex flex-col bg-viewergray items-center gap-6 p-6">
         <div className="flex items-center px-3 py-2 border border-viewerborder bg-viewerwhite gap-1 rounded-lg">
            <Calendar className="size-4" />
            <span className="text-md max-md:text-sm">
               EFFECTIVE DATE: JULY 25TH, 2025
            </span>
         </div>
         <div className="flex flex-col items-center gap-2">
            <h1 className="text-8xl max-md:text-5xl font-semibold text-viewerblack">
               Terms & Conditions
            </h1>
            <h2 className="text-2xl max-md:text-sm text-viewertext">
               Lorem Ipsum is simply dummy text of the printing and typesetting
               industry
            </h2>
         </div>
      </div>
   );
};

export default TosHeader;
