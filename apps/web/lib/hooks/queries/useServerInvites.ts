import { createApiRequest, handleApiError } from "@/lib/utils/api";
import { authClient } from "@s3-viewer/auth/client";
import { ServerInvite } from "@s3-viewer/types";
import { QueryFunctionContext, useQuery } from "@tanstack/react-query";

const useReceivedInvites = () => {
   const { data: session } = authClient.useSession();

   return useQuery<ServerInvite[]>({
      queryKey: ["received-invites"],
      queryFn: async ({
         signal,
      }: QueryFunctionContext): Promise<ServerInvite[]> => {
         const response = await createApiRequest("/server/invites/received", {
            signal,
         });

         if (!response.ok) {
            await handleApiError(response);
         }

         const { receivedInvites } = (await response.json()) as {
            receivedInvites: ServerInvite[];
         };
         return receivedInvites;
      },
      enabled: !!session?.user,
   });
};

const useSentInvites = () => {
   const { data: session } = authClient.useSession();

   return useQuery<ServerInvite[]>({
      queryKey: ["sent-invites"],
      queryFn: async ({
         signal,
      }: QueryFunctionContext): Promise<ServerInvite[]> => {
         const response = await createApiRequest("/server/invites/sent", {
            signal,
         });

         if (!response.ok) {
            await handleApiError(response);
         }

         const { sentInvites } = (await response.json()) as {
            sentInvites: ServerInvite[];
         };
         return sentInvites;
      },
      enabled: !!session?.user,
   });
};

export { useReceivedInvites, useSentInvites };
