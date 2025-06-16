import { fetchServers } from "@/utils/fetching";
import type { ServerInfo } from "@s3-viewer/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@s3-viewer/ui/components/select";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import useSessionStore from "../../utils/sessionStore";

const ServerSelector = () => {
    const setServerId = useSessionStore((state) => state.setServerId);
    const serverId = useSessionStore((state) => state.serverId);

    const { data, isLoading, error } = useQuery<ServerInfo[]>({
        queryKey: ["servers-list"],
        queryFn: fetchServers
    });

    if (isLoading) {
        return (
            <Skeleton className="bg-viewergray rounded-md w-full border-none h-10" />
        );
    }

    if (error) {
        return (
            <Select disabled>
                <SelectTrigger className="bg-viewergray rounded-md w-full border-none">
                    <SelectValue placeholder="Error loading servers" />
                </SelectTrigger>
            </Select>
        );
    }

    return (
        <Select onValueChange={(value) => setServerId(value)} value={serverId} >
            <SelectTrigger className="bg-viewergray rounded-md w-full border-none">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {data?.map((server) => (
                    <SelectItem key={server.id} value={server.id}>
                        <p>{server.name}</p>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}

export default ServerSelector;