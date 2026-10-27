import { PROVIDER_NAMES } from "@/lib/constants";
import { Provider } from "@s3-viewer/shared";
import { ServerIcon } from "lucide-react";
import Image from "next/image";

type Logo = { src: string; width: number; height: number };

// the AWS wordmark is wide, so it gets the tile's width instead of a 16px square
const LOGOS: Partial<Record<Provider, Logo>> = {
   [Provider.S3]: { src: "/icons/aws.svg", width: 20, height: 12 },
   [Provider.R2]: { src: "/icons/r2.svg", width: 16, height: 16 },
};

const ServerLogo = ({ provider }: { provider: Provider }) => {
   const logo = LOGOS[provider];
   return (
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-viewerwhite">
         {logo ? (
            <Image
               src={logo.src}
               alt={PROVIDER_NAMES[provider]}
               width={logo.width}
               height={logo.height}
            />
         ) : (
            <ServerIcon
               role="img"
               aria-label="S3-compatible server"
               className="size-4 text-viewerblack"
            />
         )}
      </span>
   );
};

export default ServerLogo;
