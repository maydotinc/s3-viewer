import useSessionStore from "@/lib/stores/sessionStore";
import { createApiRequest, handleApiError } from "@/lib/utils/api";
import { authClient } from "@s3-viewer/auth/client";
import { ServerInfo } from "@s3-viewer/types";
import { QueryFunctionContext, useQuery } from "@tanstack/react-query";

const useServers = (serverId?: string) => {
   const { data: session, isPending: isSessionPending } =
      authClient.useSession();
   const sessionServerId = useSessionStore((state) => state.serverId);
   const currentServerId = serverId || sessionServerId;

   const {
      data: servers = [],
      isPending: isServerListLoading,
      error: serverError,
      refetch,
   } = useQuery<ServerInfo[]>({
      queryKey: ["servers"],
      queryFn: async ({
         signal,
      }: QueryFunctionContext): Promise<ServerInfo[]> => {
         const response = await createApiRequest(
            "/server/retrieve/get-servers",
            {
               signal,
            }
         );

         if (!response.ok) {
            await handleApiError(response);
         }

         const { serversList } = (await response.json()) as {
            serversList: ServerInfo[];
         };
         return serversList;
      },
      enabled: !isSessionPending && !!session?.user,
   });

   const currentServer =
      servers.find((server) => server.id === currentServerId) || null;

   return {
      servers,
      currentServer,
      isServerListLoading,
      serverError,
      refreshServers: refetch,
   };
};

export default useServers;
