import {
   createServerAPI,
   deleteServerAPI,
   establishConnectionAPI,
   renameServerAPI,
   sendInvitationAPI,
} from "@/lib/api/server";
import { Role, ServerCredentials } from "@s3-viewer/types";
import { useQueryClient } from "@tanstack/react-query";

export const useServerOperations = () => {
   const queryClient = useQueryClient();

   const invalidateServers = () => {
      queryClient.invalidateQueries({ queryKey: ["servers"] });
   };

   const invalidateServer = (serverId: string) => {
      queryClient.invalidateQueries({ queryKey: ["server", serverId] });
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
         invalidateServer(serverId);
      }
      return result;
   };

   const sendInvitation = async (
      serverId: string,
      emails: string[],
      role: Role,
      expiresAt?: Date
   ) => {
      if (!expiresAt) {
         // Default to 1 day
         expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
      }
      const result = await sendInvitationAPI(serverId, emails, role, expiresAt);
      if (result.success) {
         invalidateServerUsers(serverId);
      }
      return result;
   };

   return {
      establishConnection,
      createServer,
      deleteServer,
      renameServer,
      sendInvitation,
   };
};
