import { PROVIDER_NAMES } from "@/lib/constants";
import { Provider } from "@s3-viewer/types";
import { ServerIcon } from "lucide-react";
import Image from "next/image";

const LOGOS: Partial<Record<Provider, string>> = {
   [Provider.S3]: "/icons/s3.svg",
   [Provider.R2]: "/icons/r2.svg",
};

const ServerLogo = ({ provider }: { provider: Provider }) => {
   const logo = LOGOS[provider];
   return (
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-viewerwhite">
         {logo ? (
            <Image
               src={logo}
               alt={PROVIDER_NAMES[provider]}
               width={16}
               height={16}
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
