import ServerLogo from "@/components/Layout/Sidebar/Servers/server-logo";
import useCurrentServer from "@/lib/hooks/queries/server/useCurrentServer";
import { PROVIDER_NAMES } from "@/lib/constants";
import { ROLE_LABELS } from "@s3-viewer/permissions";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { cn } from "@s3-viewer/ui/lib/utils";
import { ServerIcon, UserIcon } from "lucide-react";
import type { ReactNode } from "react";

// fixed so the header never shifts between the skeletons and the loaded chips.
const PROVIDER_WIDTH = "w-44";
const ROLE_WIDTH = "w-28";

const ICON = "size-4 shrink-0 text-viewerlighttext";

const Chip = ({
   width,
   title,
   children,
}: {
   width: string;
   title: string;
   children: ReactNode;
}) => (
   <div
      className={cn(
         "flex h-9 max-w-full items-center justify-center gap-2 rounded-lg border border-viewerborder px-3 text-sm text-viewerblack",
         width
      )}
      title={title}
   >
      {children}
   </div>
);

const ServerInfo = () => {
   const { currentServer, isLoading } = useCurrentServer();

   if (isLoading) {
      return (
         <>
            <Skeleton
               className={`h-9 rounded-lg ${PROVIDER_WIDTH}`}
               aria-busy="true"
            />
            <Skeleton
               className={`h-9 rounded-lg ${ROLE_WIDTH}`}
               aria-busy="true"
            />
         </>
      );
   }

   const provider = currentServer
      ? PROVIDER_NAMES[currentServer.provider]
      : "—";
   const role = currentServer ? ROLE_LABELS[currentServer.userRole] : "—";

   return (
      <>
         <Chip width={PROVIDER_WIDTH} title={provider}>
            {currentServer ? (
               <ServerLogo provider={currentServer.provider} />
            ) : (
               <ServerIcon className={ICON} aria-hidden="true" />
            )}
            <span className="truncate">{provider}</span>
         </Chip>
         <Chip width={ROLE_WIDTH} title={`Your role: ${role}`}>
            <UserIcon className={ICON} aria-hidden="true" />
            <span className="truncate">{role}</span>
         </Chip>
      </>
   );
};

export default ServerInfo;
