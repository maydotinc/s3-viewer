import {
   createServerAPI,
   deleteServerAPI,
   establishConnectionAPI,
   fetchServersAPI,
   renameServerAPI,
} from "@/lib/api/server";
import { ServerCredentials } from "@s3-viewer/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const useServers = () => {
   return useQuery({
      queryKey: ["servers-list"],
      queryFn: fetchServersAPI,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
   });
};

const useServerOperations = () => {
   const queryClient = useQueryClient();

   const refetchServers = () => {
      queryClient.invalidateQueries({ queryKey: ["servers-list"] });
   };

   const createServer = async (serverCredentials: ServerCredentials, serverName: string) => {
      const result = await createServerAPI(serverCredentials, serverName);
      if (result.success) {
         refetchServers();
      }
      return result;
   };

   const deleteServer = async (serverId: string) => {
      const result = await deleteServerAPI(serverId);
      if (result.success) {
         refetchServers();
      }
      return result;
   };

   const renameServer = async (serverId: string, serverName: string) => {
      const result = await renameServerAPI(serverId, serverName);
      if (result.success) {
         refetchServers();
      }
      return result;
   };

   const establishConnection = async (credentials: ServerCredentials) => {
      return await establishConnectionAPI(credentials);
   };

   return {
      createServer,
      deleteServer,
      renameServer,
      refetchServers,
      establishConnection,
   };
};

export { useServerOperations, useServers };
