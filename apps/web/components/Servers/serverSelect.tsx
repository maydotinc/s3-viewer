import { fetchServers } from "@/utils/fetching";
import type { ServerInfo } from "@s3-viewer/types";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@s3-viewer/ui/components/dropdown-menu";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { CirclePlus } from "lucide-react";
import useSessionStore from "../../utils/sessionStore";
import ServerCard from "./serverCard";
import ServerItem from "./serverItem";

const ServerSelector = () => {
    const setServerId = useSessionStore((state) => state.setServerId);
    const serverId = useSessionStore((state) => state.serverId);

    const { data, isLoading, error } = useQuery<ServerInfo[]>({
        queryKey: ["servers-list"],
        queryFn: fetchServers
    });

    if (isLoading || !data) {
        return (
            <Skeleton className="bg-viewergray rounded-md w-full border-none h-10" />
        );
    }

    if (error) {
        return (
            <p>Error loading servers</p>
        );
    }

    const selectedServer = data.find((server) => server.id === serverId);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger className="select-none">
                <ServerCard server={selectedServer} />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="select-none">
                <DropdownMenuRadioGroup value={serverId} onValueChange={setServerId}>
                    {data.map((server) => (
                        <DropdownMenuRadioItem
                            key={server.id}
                            value={server.id}
                            className="w-50 text-viewerblack"
                            onSelect={(e) => console.log("Radio item selected")}
                        >
                            <ServerItem server={server} />
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator className="w-19/20 bg-viewerborder mx-auto" />
                <DropdownMenuItem className="py-2 text-viewerblack">
                    <CirclePlus className="size-5" />
                    Add new server
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

export default ServerSelector;