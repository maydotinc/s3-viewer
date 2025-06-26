import { fetchReceivedInvites, fetchSentInvites } from "@/lib/api/server";
import { authClient } from "@s3-viewer/auth/client";
import { ServerInvite } from "@s3-viewer/types";
import { useQuery } from "@tanstack/react-query";

const useReceivedInvites = () => {
   const { data: session } = authClient.useSession();

   return useQuery<ServerInvite[]>({
      queryKey: ["received-invites"],
      queryFn: fetchReceivedInvites,
      enabled: !!session?.user,
   });
};

const useSentInvites = () => {
   const { data: session } = authClient.useSession();

   return useQuery<ServerInvite[]>({
      queryKey: ["sent-invites"],
      queryFn: fetchSentInvites,
      enabled: !!session?.user,
   });
};

export { useReceivedInvites, useSentInvites };
