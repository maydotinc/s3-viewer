import type { ServerInfo } from "@s3-viewer/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@s3-viewer/ui/components/select";
import { Skeleton } from "@s3-viewer/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import useSessionStore from "../../utils/sessionStore";

const ServerSelector = () => {
    const setServerId = useSessionStore((state) => state.setServerId);
    const { data, isLoading, error } = useQuery<ServerInfo[]>({
        queryKey: ["servers-list"],
        queryFn: async () => {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/retrieve/get-servers`, {
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch servers: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return data.serversList;
        }
    });

    const handleServerSelect = (serverId: string) => {
        setServerId(serverId);
    }

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
        <Select onValueChange={handleServerSelect}>
            <SelectTrigger className="bg-viewergray rounded-md w-full border-none">
                <SelectValue placeholder="Select a server" />
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