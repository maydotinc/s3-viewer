import { authClient } from "@/lib/auth";
import { useUserId } from "@/lib/stores/session-store";

const useSessionReady = (): {
   isSessionReady: boolean;
   isSessionPending: boolean;
} => {
   const userId = useUserId();
   const { data: session, isPending } = authClient.useSession();
   return {
      isSessionReady:
         Boolean(userId && session?.user.id === userId) && !isPending,
      isSessionPending: isPending,
   };
};

export { useSessionReady };
