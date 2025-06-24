import useSessionStore from "@/lib/stores/sessionStore";
import { authClient } from "@s3-viewer/auth/client";
import { useEffect } from "react";

const SessionManager = () => {
   const { data: session, isPending } = authClient.useSession();
   const { setUserId, clearSession } = useSessionStore();

   useEffect(() => {
      if (isPending) return;

      if (session?.user) {
         setUserId(session.user.id);
      } else {
         clearSession();
      }
   }, [session, isPending, setUserId, clearSession]);

   return null;
};

export default SessionManager;
