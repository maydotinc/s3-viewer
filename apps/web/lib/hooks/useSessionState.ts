import { authClient } from "@/lib/auth";
import { useHydrated } from "@/lib/hooks/useHydrated";
import { useEffect, useState } from "react";

const SESSION_TIMEOUT_MS = 8000;

// `unreachable`: the session request failed or has not answered in time. it
// is not `signedOut`, which would send a visitor to the login page and, once
// the answer landed with a user, straight back again
type SessionState = "pending" | "signedIn" | "signedOut" | "unreachable";

// `attempt` restarts the clock: bump it when asking for the session again
const useSessionState = (attempt = 0): SessionState => {
   const hydrated = useHydrated();
   const { data: session, isPending, error } = authClient.useSession();
   const [timedOut, setTimedOut] = useState(false);

   useEffect(() => {
      setTimedOut(false);
      if (!isPending) return;
      const timer = setTimeout(() => setTimedOut(true), SESSION_TIMEOUT_MS);
      return () => clearTimeout(timer);
   }, [isPending, attempt]);

   if (!hydrated) return "pending";
   if (session) return "signedIn";
   if (error || (isPending && timedOut)) return "unreachable";
   if (isPending) return "pending";
   return "signedOut";
};

export { useSessionState };
export type { SessionState };
