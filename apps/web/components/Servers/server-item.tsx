import useSessionStore from "@/lib/stores/sessionStore";
import { ServerInfo } from "@s3-viewer/types";
import { CircleIcon, ServerIcon } from "lucide-react";
import ServerActions from "./server-actions";

type ServerItemProps = {
   server: ServerInfo;
};

const ServerItem = ({ server }: ServerItemProps) => {
   const serverId = useSessionStore((state) => state.serverId);

   return (
      <div className="flex gap-2 items-center w-full pl-2 py-2">
         {serverId === server.id ? (
            <CircleIcon className="size-4 text-viewerblue fill-viewerblue" />
         ) : (
            <CircleIcon className="size-4 text-viewerborder" />
         )}
         <div className="flex gap-2 items-center flex-1">
            <ServerIcon className="size-4" />
            <p>{server.name}</p>
         </div>
         <div
            onClick={(e) => e.preventDefault()}
            className="ml-auto flex items-center hover:text-viewerblue"
         >
            <ServerActions server={server} />
         </div>
      </div>
   );
};

export default ServerItem;
