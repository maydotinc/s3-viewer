import { fetchServerUsers } from "@/lib/api/server";
import { authClient } from "@s3-viewer/auth/client";
import { useQuery } from "@tanstack/react-query";

const useServerUsers = (serverId: string) => {
   const { data: session } = authClient.useSession();
   const isAuthenticated = !!session?.user;

   const {
      data: serverUsers = [],
      isPending: isLoading,
      error,
      refetch,
   } = useQuery({
      queryKey: ["server-users", serverId],
      queryFn: fetchServerUsers,
      enabled: !!serverId && isAuthenticated,
      staleTime: 1000 * 60 * 2, // 2 minutes
   });

   return {
      serverUsers,
      isLoading,
      error,
      refetch,
   };
};

export default useServerUsers;
