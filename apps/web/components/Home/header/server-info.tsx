import type { ServerInfo } from "@s3-viewer/types";
import { UserIcon } from "lucide-react";
import ServerLogo from "../../Layout/Sidebar/Servers/server-logo";

type ServerInfoProps = {
   server: ServerInfo;
};

const ServerInfo = ({ server }: ServerInfoProps) => {
   return (
      <div className="flex flex-none gap-2 h-fit">
         <div className="flex gap-2 border border-viewerborder rounded-xl p-2 items-center">
            <ServerLogo provider={server.provider} />
            <div className="flex flex-col items-start gap-1">
               <span className="text-viewertext text-sm leading-none">
                  Provider
               </span>
               <span className="text-viewerblack text-md font-semibold leading-none max-w-[150px] truncate">
                  {server?.name}
               </span>
            </div>
         </div>
         <div className="flex gap-2 items-center border border-viewerborder rounded-xl p-2">
            <div className="bg-viewerblue/5 rounded-lg p-2">
               <UserIcon className="size-5 text-viewerblue" />
            </div>
            <div className="flex flex-col items-start gap-1">
               <span className="text-viewertext text-sm leading-none">
                  Role
               </span>
               <span className="text-viewerblack text-md font-semibold leading-none max-w-[150px] truncate">
                  {server?.userRole.charAt(0) +
                     server?.userRole.toLowerCase().slice(1)}
               </span>
            </div>
         </div>
      </div>
   );
};

export default ServerInfo;
