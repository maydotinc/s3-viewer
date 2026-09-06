import FullPageSpinner from "@/components/Session/full-page-spinner";
import SessionUnreachable from "@/components/Session/session-unreachable";
import { isSigningOut, refetchSession } from "@/lib/auth";
import { afterLoginPath, loginPathFor } from "@/lib/auth-redirect";
import useInstanceConfig from "@/lib/hooks/queries/useInstanceConfig";
import { useSessionState } from "@/lib/hooks/useSessionState";
import { SITE_PATHS } from "@s3-viewer/types";
import { useRouter } from "next/router";
import { useEffect, useRef, useState, type ReactNode } from "react";

// the screens that take a signed-out visitor through to a session
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

// the one place that renders the full-page spinner: a sign-out goes from a
// private page to an auth screen (and a login the other way) with the spinner
// up throughout, and one owner keeps it the same element, so the animation
// never restarts mid-way.
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
      // a deliberate sign-out owns its destination (plain /login, no `next`)
      if (isSigningOut()) return;
      // before the router is ready a dynamic route's asPath is still the
      // `[param]` pattern, which would become a useless `next=`
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
   // neither a private page nor a login form can do anything without the
   // session request answering, so both get the same honest state and retry
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
      // the form waits for the query string (its notice), the session (a
      // signed-in visitor is sent on instead) and the instance config (the
      // github button, the email transport), so nothing appears inside it
      // after it is shown. `isLoading` rather than `isPending`: a config
      // fetch paused offline should not hold the page on a spinner
      const ready = router.isReady && signedOut && !config.isLoading;
      return ready ? children : <FullPageSpinner />;
   }
   if (!signedIn) return <FullPageSpinner />;
   return children;
};

export default AuthGuard;
