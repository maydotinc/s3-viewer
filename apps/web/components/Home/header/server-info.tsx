import ServerLogo from "@/components/Layout/Sidebar/Servers/server-logo";
import useServers from "@/lib/hooks/queries/server/useServers";
import { ROLE_LABELS } from "@s3-viewer/permissions";
import { Provider } from "@s3-viewer/types";
import { Spinner } from "@s3-viewer/ui/components/spinner";
import { ServerIcon, UserIcon } from "lucide-react";

const PROVIDER_LABELS: Record<Provider, string> = {
   [Provider.S3]: "AWS",
   [Provider.R2]: "Cloudflare",
   [Provider.Other]: "Other",
};

const CARD =
   "flex h-14 min-w-40 items-center gap-2 rounded-xl border border-viewerborder p-2";

const Card = ({
   icon,
   label,
   value,
}: {
   icon: React.ReactNode;
   label: string;
   value: string;
}) => (
   <div className={CARD}>
      {icon}
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
         <span className="text-xs leading-none text-viewertext">{label}</span>
         <span className="max-w-[150px] min-w-24 truncate text-md font-semibold leading-none text-viewerblack">
            {value}
         </span>
      </div>
   </div>
);

const ServerInfo = () => {
   const { currentServer, isServerListLoading } = useServers();

   if (isServerListLoading) {
      return (
         <div className="flex flex-none gap-2" aria-busy="true">
            {["provider", "role"].map((card) => (
               <div key={card} className={`${CARD} justify-center`}>
                  <Spinner size="sm" label={`Loading ${card}`} />
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
      <div className="fade-in flex flex-none gap-2">
         <Card
            icon={
               currentServer ? (
                  <ServerLogo provider={currentServer.provider} />
               ) : (
                  <div className="flex-none rounded-lg bg-viewergray p-2">
                     <ServerIcon
                        className="size-5 text-viewerlighttext"
                        aria-hidden="true"
                     />
                  </div>
               )
            }
            label="Provider"
            value={provider}
         />
         <Card
            icon={
               <div className="flex-none rounded-lg bg-viewerblue/5 p-2">
                  <UserIcon
                     className="size-5 text-viewerblue"
                     aria-hidden="true"
                  />
               </div>
            }
            label="Role"
            value={role}
         />
      </div>
   );
};

export default ServerInfo;
