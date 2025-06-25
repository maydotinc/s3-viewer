import { fetchReceivedInvites } from "@/lib/api/server";
import { authClient } from "@s3-viewer/auth/client";
import { ServerInvite } from "@s3-viewer/types";
import { useQuery } from "@tanstack/react-query";

const useServerInvites = () => {
   const { data: session } = authClient.useSession();
   const {
      data: receivedInvites,
      isLoading: isReceivedInvitesLoading,
      error: receivedInvitesError,
   } = useQuery<ServerInvite[]>({
      queryKey: ["received-invites"],
      queryFn: fetchReceivedInvites,
      enabled: !!session?.user,
   });

   return {
      receivedInvites,
      isReceivedInvitesLoading,
      receivedInvitesError,
   };
};

export default useServerInvites;
