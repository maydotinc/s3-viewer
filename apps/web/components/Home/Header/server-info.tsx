import ServerLogo from "@/components/Layout/Sidebar/Servers/server-logo";
import useCurrentServer from "@/lib/hooks/queries/server/useCurrentServer";
import { PROVIDER_NAMES } from "@/lib/constants";
import { ROLE_LABELS } from "@s3-viewer/permissions";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { ServerIcon, UserIcon } from "lucide-react";

// fixed so the header never shifts between the skeleton and the loaded chip.
const WIDTH = "w-[17rem] max-w-full";

const SEGMENT = "flex h-full min-w-0 items-center gap-2 px-3";

const ICON = "size-4 shrink-0 text-viewerlighttext";

const ServerInfo = () => {
   const { currentServer, isLoading } = useCurrentServer();

   if (isLoading) {
      return (
         <Skeleton className={`h-9 rounded-lg ${WIDTH}`} aria-busy="true" />
      );
   }

   const provider = currentServer
      ? PROVIDER_NAMES[currentServer.provider]
      : "—";
   const role = currentServer ? ROLE_LABELS[currentServer.userRole] : "—";

   return (
      <div
         className={`flex h-9 items-center rounded-lg border border-viewerborder text-sm text-viewerblack ${WIDTH}`}
      >
         <div className={`${SEGMENT} flex-1`} title={provider}>
            {currentServer ? (
               <ServerLogo provider={currentServer.provider} />
            ) : (
               <ServerIcon className={ICON} aria-hidden="true" />
            )}
            <span className="truncate">{provider}</span>
         </div>
         <div
            className="w-px self-stretch bg-viewerborder"
            aria-hidden="true"
         />
         <div className={`${SEGMENT} shrink-0`} title={`Your role: ${role}`}>
            <UserIcon className={ICON} aria-hidden="true" />
            <span className="truncate">{role}</span>
         </div>
      </div>
   );
};

export default ServerInfo;
