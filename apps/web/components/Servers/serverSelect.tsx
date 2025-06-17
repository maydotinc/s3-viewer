import { fetchServers } from "@/utils/fetching";
import type { ServerInfo } from "@s3-viewer/types";
import { Button } from "@s3-viewer/ui/components/button";
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
            <DropdownMenuTrigger>
                <ServerCard server={selectedServer} />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="rounded-xl text-viewerblack">
                <DropdownMenuRadioGroup value={serverId} onValueChange={setServerId}>
                {data.map((server) => (
                    <DropdownMenuRadioItem key={server.id} value={server.id}>
                        <ServerItem server={server} />
                    </DropdownMenuRadioItem>
                ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator className="w-19/20 bg-viewerborder mx-auto" />
                <DropdownMenuItem className="p-0">
                    <Button variant="ghost" className="w-full gap-2">
                        <CirclePlus className="size-5" />
                        Add new server
                    </Button>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

export default ServerSelector;