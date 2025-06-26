import { createApiRequest, handleApiError } from "@/lib/utils/api";
import { authClient } from "@s3-viewer/auth/client";
import { ServerUser } from "@s3-viewer/types";
import { QueryFunctionContext, useQuery } from "@tanstack/react-query";

const useServerUsers = (serverId: string) => {
   const { data: session } = authClient.useSession();

   const {
      data: serverUsers = [],
      isPending: isServerUsersLoading,
      error: serverUsersError,
      refetch,
   } = useQuery<ServerUser[]>({
      queryKey: ["server-users", serverId],
      queryFn: async ({
         queryKey,
         signal,
      }: QueryFunctionContext): Promise<ServerUser[]> => {
         const [, serverId] = queryKey as [string, string];

         const response = await createApiRequest(
            `/retrieve/get-server-users?serverId=${serverId}`,
            { signal }
         );

         if (!response.ok) {
            await handleApiError(response);
         }

         const { serverUsers } = (await response.json()) as {
            serverUsers: ServerUser[];
         };
         return serverUsers;
      },
      enabled: !!session?.user && !!serverId,
   });

   return {
      serverUsers,
      isServerUsersLoading,
      serverUsersError,
      refreshServerUsers: refetch,
   };
};

export default useServerUsers;
