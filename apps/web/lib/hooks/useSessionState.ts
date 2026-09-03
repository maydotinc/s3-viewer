import { authClient } from "@/lib/auth";
import { useHydrated } from "@/lib/hooks/useHydrated";
import { useEffect, useState } from "react";

const SESSION_TIMEOUT_MS = 8000;

type SessionState = "pending" | "signedIn" | "signedOut";

const useSessionState = (): SessionState => {
   const hydrated = useHydrated();
   const { data: session, isPending, error } = authClient.useSession();
   const [timedOut, setTimedOut] = useState(false);

   useEffect(() => {
      if (!isPending) return;
      const timer = setTimeout(() => setTimedOut(true), SESSION_TIMEOUT_MS);
      return () => clearTimeout(timer);
   }, [isPending]);

   if (!hydrated) return "pending";
   if (session) return "signedIn";
   if (isPending && !timedOut && !error) return "pending";
   return "signedOut";
};

export { useSessionState };
