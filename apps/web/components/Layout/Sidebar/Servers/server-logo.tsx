import { Provider } from "@s3-viewer/types";
import { cn } from "@s3-viewer/ui/lib/utils";
import { ServerIcon } from "lucide-react";

type ServerLogoProps = {
   provider: Provider;
   variant?: "small" | "large";
};

const ServerLogo = ({ provider, variant = "large" }: ServerLogoProps) => {
   let icon;
   if (provider === Provider.S3) {
      icon = (
         <img
            src="/icons/s3.svg"
            alt="S3"
            className={cn("w-6 h-6", variant === "small" && "w-4 h-4")}
         />
      );
   } else if (provider === Provider.R2) {
      icon = (
         <img
            src="/icons/r2.svg"
            alt="R2"
            className={cn("w-6 h-6", variant === "small" && "w-4 h-4")}
         />
      );
   } else {
      icon = (
         <ServerIcon
            className={cn(
               "text-viewerblack w-6 h-6",
               variant === "small" && "w-4 h-4"
            )}
         />
      );
   }

   return (
      <div
         className={cn(
            "bg-viewerwhite border border-xs rounded-lg p-2",
            variant === "small" && "p-1 rounded-sm"
         )}
      >
         {icon}
      </div>
   );
};

export default ServerLogo;
