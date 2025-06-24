import {
   createServerAPI,
   deleteServerAPI,
   establishConnectionAPI,
   renameServerAPI,
} from "@/lib/api/server";
import { ServerCredentials } from "@s3-viewer/types";
import { useQueryClient } from "@tanstack/react-query";

export const useServerOperations = () => {
   const queryClient = useQueryClient();

   const invalidateServers = () => {
      queryClient.invalidateQueries({ queryKey: ["servers"] });
   };

   const invalidateServerUsers = (serverId?: string) => {
      if (serverId) {
         queryClient.invalidateQueries({ queryKey: ["server-users", serverId] });
      } else {
         queryClient.invalidateQueries({ queryKey: ["server-users"] });
      }
   };

   const establishConnection = async (credentials: ServerCredentials) => {
      const result = await establishConnectionAPI(credentials);
      return result;
   };

   const createServer = async (serverCredentials: ServerCredentials, serverName: string) => {
      const result = await createServerAPI(serverCredentials, serverName);
      if (result.success) {
         invalidateServers();
      }
      return result;
   };

   const deleteServer = async (serverId: string) => {
      const result = await deleteServerAPI(serverId);
      if (result.success) {
         invalidateServers();
         invalidateServerUsers(serverId);
      }
      return result;
   };

   const renameServer = async (serverId: string, serverName: string) => {
      const result = await renameServerAPI(serverId, serverName);
      if (result.success) {
         invalidateServers();
      }
      return result;
   };

   return {
      establishConnection,
      createServer,
      deleteServer,
      renameServer,
   };
};
