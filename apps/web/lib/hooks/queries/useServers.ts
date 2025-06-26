import { fetchServers } from "@/lib/api/server";
import { authClient } from "@s3-viewer/auth/client";
import { ServerInfo } from "@s3-viewer/types";
import { useQuery } from "@tanstack/react-query";

const useServers = () => {
   const { data: session } = authClient.useSession();

   const {
      data: servers = [],
      isPending: isServerListLoading,
      error: serverError,
      refetch,
   } = useQuery<ServerInfo[]>({
      queryKey: ["servers"],
      queryFn: fetchServers,
      enabled: !!session?.user,
   });

   return {
      servers,
      isServerListLoading,
      serverError,
      refreshServers: refetch,
   };
};

export default useServers;
