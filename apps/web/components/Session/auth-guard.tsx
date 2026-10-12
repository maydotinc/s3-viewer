import FullPageSpinner from "./full-page-spinner";
import SessionUnreachable from "./session-unreachable";
import ShellSkeleton from "./shell-skeleton";
import { isSigningOut, refetchSession } from "@/lib/auth";
import { afterLoginPath, loginPathFor } from "@/lib/auth-redirect";
import useInstanceConfig from "@/lib/hooks/queries/useInstanceConfig";
import { useSessionState } from "@/lib/hooks/useSessionState";
import { SITE_PATHS } from "@s3-viewer/types";
import { useRouter } from "next/router";
import { useEffect, useRef, useState, type ReactNode } from "react";

const AUTH_SCREENS = new Set<string>([
   SITE_PATHS.login,
   SITE_PATHS.signup,
   SITE_PATHS.forgotPassword,
]);

const PUBLIC_PATHS = new Set<string>([
   ...AUTH_SCREENS,
   SITE_PATHS.resetPassword,
   "/404",
   "/_error",
]);

const AuthGuard = ({ children }: { children: ReactNode }) => {
   const router = useRouter();
   const [attempt, setAttempt] = useState(0);
   const sessionState = useSessionState(attempt);
   const config = useInstanceConfig();
   const isAuthScreen = AUTH_SCREENS.has(router.pathname);
   const isPublic = PUBLIC_PATHS.has(router.pathname);
   const signedOut = sessionState === "signedOut";
   const signedIn = sessionState === "signedIn";
   const unreachable = sessionState === "unreachable";
   const destination = afterLoginPath(router.query.next);
   const sentToLogin = useRef(false);
   const sentToApp = useRef(false);

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

   if (isPublic && !isAuthScreen) return children;
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
   if (isAuthScreen) {
      // `isLoading`, not `isPending`: a config fetch paused offline must not hold the spinner.
      const ready = router.isReady && signedOut && !config.isLoading;
      return ready ? children : <FullPageSpinner />;
   }
   if (!signedIn) return <ShellSkeleton />;
   return children;
};

export default AuthGuard;
