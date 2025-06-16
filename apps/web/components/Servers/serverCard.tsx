import { ServerInfo } from "@s3-viewer/types";

type ServerCardProps = {
    server: ServerInfo;
}

const ServerCard = ({ server }: ServerCardProps) => {
    return (
        <div>
            <h1>Server Card</h1>
        </div>
    )
}

export default ServerCard;