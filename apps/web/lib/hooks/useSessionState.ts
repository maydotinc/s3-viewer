import { authClient } from "@/lib/auth";
import { useHydrated } from "./useHydrated";
import { useEffect, useState } from "react";

const SESSION_TIMEOUT_MS = 8000;

type SessionState = "pending" | "signedIn" | "signedOut" | "unreachable";

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
