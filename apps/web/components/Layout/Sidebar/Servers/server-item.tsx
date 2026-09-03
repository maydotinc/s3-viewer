import { ServerInfo } from "@s3-viewer/types";
import { cn } from "@s3-viewer/ui/lib/utils";
import { Circle } from "lucide-react";
import ServerActions from "./server-actions";
import ServerLogo from "./server-logo";

type ServerItemProps = {
   server: ServerInfo;
   selected: boolean;
};

const ServerItem = ({ server, selected }: ServerItemProps) => (
   <span className="flex w-full items-center gap-2 py-1 pl-1">
      <Circle
         aria-hidden="true"
         className={cn(
            "size-3 shrink-0",
            selected ? "fill-viewerblue text-viewerblue" : "text-viewerborder"
         )}
      />
      <ServerLogo provider={server.provider} />
      <span className="min-w-0 flex-1 truncate text-viewerblack">
         {server.name}
      </span>
      <ServerActions server={server} />
   </span>
);

export default ServerItem;
