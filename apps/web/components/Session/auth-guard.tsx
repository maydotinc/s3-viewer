import SessionUnreachable from "./session-unreachable";
import ShellSkeleton from "./shell-skeleton";
import { authClient, isSigningOut, refetchSession, signOut } from "@/lib/auth";
import {
   afterLoginPath,
   AUTH_SCREENS,
   loginPathFor,
   PUBLIC_PATHS,
} from "@/lib/auth-redirect";
import { useSessionState } from "@/lib/hooks/useSessionState";
import { SITE_PATHS } from "@s3-viewer/types";
import { useRouter } from "next/router";
import { useEffect, useRef, useState, type ReactNode } from "react";

const AuthGuard = ({ children }: { children: ReactNode }) => {
   const router = useRouter();
   const [attempt, setAttempt] = useState(0);
   const sessionState = useSessionState(attempt);
   const { data: session } = authClient.useSession();
   const isAuthScreen = AUTH_SCREENS.has(router.pathname);
   const isPublic = PUBLIC_PATHS.has(router.pathname);
   const signedOut = sessionState === "signedOut";
   const signedIn = sessionState === "signedIn";
   const unreachable = sessionState === "unreachable";
   const unverified = session?.user.emailVerified === false;
   const destination = afterLoginPath(router.query.next);
   const sentToLogin = useRef(false);
   const sentToApp = useRef(false);

   // a session from before verification was required is ended rather than honoured.
   useEffect(() => {
      if (!unverified || isSigningOut()) return;
      void signOut(
         isPublic ? SITE_PATHS.login : loginPathFor(router.asPath)
      ).catch(() => undefined);
   }, [unverified, isPublic, router.asPath]);

   useEffect(() => {
      if (isPublic || !signedOut) {
         sentToLogin.current = false;
         return;
      }
      if (sentToLogin.current) return;
      if (isSigningOut()) return;
      // before the router is ready, asPath is still the `[param]` pattern.
      if (!router.isReady) return;
      sentToLogin.current = true;
      void router.replace(loginPathFor(router.asPath));
   }, [isPublic, signedOut, router]);

   useEffect(() => {
      if (!isAuthScreen || !signedIn) {
         sentToApp.current = false;
         return;
      }
      if (sentToApp.current || isSigningOut()) return;
      sentToApp.current = true;
      void router.replace(destination);
   }, [isAuthScreen, signedIn, destination, router]);

   // auth screens are the retry UI for everything, so they render at once and never gate on a request.
   if (isPublic) return children;
   if (unreachable) {
      return (
         <SessionUnreachable
            onRetry={() => {
               setAttempt((count) => count + 1);
               void refetchSession();
            }}
         />
      );
   }
   if (!signedIn) return <ShellSkeleton />;
   return children;
};

export default AuthGuard;
