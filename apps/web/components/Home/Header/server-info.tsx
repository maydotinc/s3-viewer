import ServerLogo from "@/components/Layout/Sidebar/Servers/server-logo";
import useCurrentServer from "@/lib/hooks/queries/server/useCurrentServer";
import { PROVIDER_NAMES } from "@/lib/constants";
import { ROLE_LABELS } from "@s3-viewer/permissions";
import { Role } from "@s3-viewer/types";
import { Spinner } from "@s3-viewer/ui/components/spinner";
import { cn } from "@s3-viewer/ui/lib/utils";
import {
   Crown,
   Eye,
   PenLine,
   ServerIcon,
   ShieldCheck,
   UserIcon,
   type LucideIcon,
} from "lucide-react";

const ROLE_ICONS: Record<Role, LucideIcon> = {
   [Role.OWNER]: Crown,
   [Role.ADMIN]: ShieldCheck,
   [Role.EDITOR]: PenLine,
   [Role.VIEWER]: Eye,
};

const CHIP =
   "flex h-9 max-w-full min-w-0 items-center rounded-lg border border-viewerborder text-sm text-viewerblack";

const SEGMENT = "flex h-full min-w-0 items-center gap-2 px-3";

const ICON = "size-4 shrink-0 text-viewerlighttext";

const ServerInfo = () => {
   const { currentServer, isLoading } = useCurrentServer();

   if (isLoading) {
      return (
         <div className={cn(CHIP, "w-56 justify-center")} aria-busy="true">
            <Spinner size="sm" label="Loading server details" />
         </div>
      );
   }

   const provider = currentServer
      ? PROVIDER_NAMES[currentServer.provider]
      : "—";
   const role = currentServer ? ROLE_LABELS[currentServer.userRole] : "—";
   const RoleIcon = currentServer
      ? ROLE_ICONS[currentServer.userRole]
      : UserIcon;

   return (
      <div className={CHIP}>
         <div className={SEGMENT} title={provider}>
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
         <div className={SEGMENT} title={`Your role: ${role}`}>
            <RoleIcon className={ICON} aria-hidden="true" />
            <span className="truncate">{role}</span>
         </div>
      </div>
   );
};

export default ServerInfo;
