import ServerLogo from "@/components/Layout/Sidebar/Servers/server-logo";
import useServers from "@/lib/hooks/queries/server/useServers";
import { ROLE_LABELS } from "@s3-viewer/permissions";
import { Provider } from "@s3-viewer/types";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { ServerIcon, UserIcon } from "lucide-react";

const PROVIDER_LABELS: Record<Provider, string> = {
   [Provider.S3]: "AWS",
   [Provider.R2]: "Cloudflare",
   [Provider.Other]: "Other",
};

const CHIP =
   "flex h-9 items-center gap-2 rounded-lg border border-viewerborder px-3 text-sm text-viewerblack";

const ServerInfo = () => {
   const { currentServer, isServerListLoading } = useServers();

   if (isServerListLoading) {
      return (
         <div className="flex shrink-0 items-center gap-2" aria-busy="true">
            {["provider", "role"].map((chip) => (
               <div key={chip} className={CHIP}>
                  <Skeleton className="size-4 shrink-0 rounded" />
                  <Skeleton className="h-3.5 w-16" />
               </div>
            ))}
         </div>
      );
   }

   const provider = currentServer
      ? PROVIDER_LABELS[currentServer.provider]
      : "—";
   const role = currentServer ? ROLE_LABELS[currentServer.userRole] : "—";

   return (
      <div className="flex shrink-0 items-center gap-2">
         <div className={CHIP}>
            {currentServer ? (
               <ServerLogo provider={currentServer.provider} />
            ) : (
               <ServerIcon
                  className="size-4 shrink-0 text-viewerlighttext"
                  aria-hidden="true"
               />
            )}
            <span>{provider}</span>
         </div>
         <div className={CHIP}>
            <UserIcon
               className="size-4 shrink-0 text-viewerlighttext"
               aria-hidden="true"
            />
            <span>{role}</span>
         </div>
      </div>
   );
};

export default ServerInfo;
