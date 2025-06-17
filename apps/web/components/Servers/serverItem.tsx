import { ServerInfo } from "@s3-viewer/types";
import { ServerIcon } from "lucide-react";

type ServerItemProps = {
    server: ServerInfo;
}

const ServerItem = ({ server }: ServerItemProps) => {
    return (
        <div className="flex gap-2 items-center w-full">
            <ServerIcon className="size-4" />
            <p>{server.name}</p>
        </div>
    )
}

export default ServerItem;