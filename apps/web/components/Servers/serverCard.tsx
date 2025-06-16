import { ServerInfo } from "@s3-viewer/types";
import ServerActions from "./serverActions";

type ServerCardProps = {
    server: ServerInfo;
}

const ServerCard = ({ server }: ServerCardProps) => {
    return (
        <div className="flex gap-2">
            <p>{server.name}</p>
            <ServerActions server={server} />
        </div>
    )
}

export default ServerCard;