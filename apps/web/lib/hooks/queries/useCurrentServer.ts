import useSessionStore from "@/lib/stores/sessionStore";
import { ServerInfo } from "@s3-viewer/types";
import useServers from "./useServers";

const useCurrentServer = (serverId?: string): ServerInfo | null => {
   const currentServerId =
      serverId || useSessionStore((state) => state.serverId);
   const { servers } = useServers();

   return servers.find((server) => server.id === currentServerId) || null;
};

export default useCurrentServer;
