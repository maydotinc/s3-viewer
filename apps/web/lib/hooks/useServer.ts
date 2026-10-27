import useServers from "@/lib/hooks/queries/server/useServers";

const useServer = (serverId: string | null | undefined) =>
   useServers().servers.find((server) => server.id === serverId);

export default useServer;
