import { ServerInfo } from "@s3-viewer/types";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { ChevronsLeftRight, Circle, Database, ServerIcon } from "lucide-react";

type ServerCardProps = {
    server: ServerInfo | undefined;
}

const ServerCard = ({ server }: ServerCardProps) => {
    if (!server) {
        return (
            <Skeleton className="bg-viewergray rounded-md w-full border-none h-10" />
        )
    }

    return (
        <div className="flex flex-col gap-2 bg-viewergray rounded-xl w-full border-none p-2 cursor-pointer select-none">
            <div className="flex gap-2 items-center">
                <Circle className="size-2 text-green-500" />
                <ServerIcon className="size-4" />
                <p className="text-md font-semibold">{server.name}</p>
                <div className="flex gap-2 items-center ml-auto border border-viewerborder rounded-full p-1.5 bg-viewerwhite">
                    <ChevronsLeftRight className="size-4 rotate-90 text-viewertext" />
                </div>
            </div>
            <div className="flex gap-2 items-center">
                <Database className="size-4" />
                <p>{server.storageUsed} GB</p>
            </div>
        </div>
    )
}

export default ServerCard;