import ServerLogo from "@/components/Layout/Sidebar/Servers/server-logo";
import useCurrentServer from "@/lib/hooks/queries/server/useCurrentServer";
import { PROVIDER_NAMES } from "@/lib/constants";
import { ROLE_LABELS } from "@s3-viewer/permissions";
import { Spinner } from "@s3-viewer/ui/components/spinner";
import { ServerIcon, UserIcon } from "lucide-react";

const CHIP =
   "flex h-9 min-w-0 items-center gap-2 rounded-lg border border-viewerborder px-3 text-sm text-viewerblack";

const ServerInfo = () => {
   const { currentServer, isLoading } = useCurrentServer();

   if (isLoading) {
      return (
         <div
            className="grid w-64 max-w-full grid-cols-[minmax(0,1fr)_6.5rem] gap-2"
            aria-busy="true"
         >
            {["provider", "role"].map((chip) => (
               <div key={chip} className={`${CHIP} justify-center`}>
                  <Spinner label={`Loading ${chip}`} />
               </div>
            ))}
         </div>
      );
   }

   const provider = currentServer
      ? PROVIDER_NAMES[currentServer.provider]
      : "—";
   const role = currentServer ? ROLE_LABELS[currentServer.userRole] : "—";

   return (
      <div className="grid w-64 max-w-full grid-cols-[minmax(0,1fr)_6.5rem] gap-2">
         <div className={CHIP}>
            {currentServer ? (
               <ServerLogo provider={currentServer.provider} />
            ) : (
               <ServerIcon
                  className="size-4 shrink-0 text-viewerlighttext"
                  aria-hidden="true"
               />
            )}
            <span className="truncate" title={provider}>
               {provider}
            </span>
         </div>
         <div className={CHIP}>
            <UserIcon
               className="size-4 shrink-0 text-viewerlighttext"
               aria-hidden="true"
            />
            <span className="truncate" title={role}>
               {role}
            </span>
         </div>
      </div>
   );
};

export default ServerInfo;
