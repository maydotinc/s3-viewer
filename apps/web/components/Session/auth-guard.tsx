import FullPageSpinner from "@/components/Session/full-page-spinner";
import { isSigningOut } from "@/lib/auth";
import { loginPathFor } from "@/lib/auth-redirect";
import { useSessionState } from "@/lib/hooks/useSessionState";
import { SITE_PATHS } from "@s3-viewer/types";
import { useRouter } from "next/router";
import { useEffect, useRef, type ReactNode } from "react";

const PUBLIC_PATHS = new Set([
   SITE_PATHS.login,
   SITE_PATHS.signup,
   SITE_PATHS.forgotPassword,
   SITE_PATHS.resetPassword,
   "/404",
   "/_error",
]);

const AuthGuard = ({ children }: { children: ReactNode }) => {
   const router = useRouter();
   const sessionState = useSessionState();
   const isPublic = PUBLIC_PATHS.has(router.pathname);
   const signedOut = sessionState === "signedOut";
   const redirected = useRef(false);

   useEffect(() => {
      if (isPublic || !signedOut) {
         redirected.current = false;
         return;
      }
      if (redirected.current) return;
      // a deliberate sign-out owns its destination (plain /login, no `next`)
      if (isSigningOut()) return;
      // before the router is ready a dynamic route's asPath is still the
      // `[param]` pattern, which would become a useless `next=`
      if (!router.isReady) return;
      redirected.current = true;
      void router.replace(loginPathFor(router.asPath));
   }, [isPublic, signedOut, router]);

   if (isPublic) return children;
   if (sessionState !== "signedIn") return <FullPageSpinner />;
   return children;
};

export default AuthGuard;
