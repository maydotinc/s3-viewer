import { PROVIDER_NAMES } from "@/lib/constants";
import { Provider } from "@s3-viewer/types";
import { cn } from "@s3-viewer/ui/lib/utils";
import { ServerIcon } from "lucide-react";
import Image from "next/image";

type ServerLogoProps = {
   provider: Provider;
   size?: "sm" | "md";
};

const LOGOS: Partial<Record<Provider, string>> = {
   [Provider.S3]: "/icons/s3.svg",
   [Provider.R2]: "/icons/r2.svg",
};

const ServerLogo = ({ provider, size = "sm" }: ServerLogoProps) => {
   const px = size === "sm" ? 16 : 20;
   const logo = LOGOS[provider];
   return (
      <span
         className={cn(
            "flex shrink-0 items-center justify-center rounded-md bg-viewerwhite",
            size === "sm" ? "size-6" : "size-9"
         )}
      >
         {logo ? (
            <Image
               src={logo}
               alt={PROVIDER_NAMES[provider]}
               width={px}
               height={px}
            />
         ) : (
            <ServerIcon
               aria-label="S3-compatible server"
               className="text-viewerblack"
               style={{ width: px, height: px }}
            />
         )}
      </span>
   );
};

export default ServerLogo;
