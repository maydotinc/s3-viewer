import FullPageSkeleton from "@/components/Session/full-page-skeleton";
import { authClient } from "@/lib/auth";
import { loginPathFor } from "@/lib/auth-redirect";
import { SITE_PATHS } from "@s3-viewer/types";
import { useRouter } from "next/router";
import { useEffect, useRef, type ReactNode } from "react";

const PUBLIC_PATHS = new Set([
   SITE_PATHS.login,
   SITE_PATHS.signup,
   SITE_PATHS.verify,
   "/404",
   "/500",
   "/_error",
]);

const AuthGuard = ({ children }: { children: ReactNode }) => {
   const router = useRouter();
   const { data: session, isPending } = authClient.useSession();
   const isPublic = PUBLIC_PATHS.has(router.pathname);
   const signedOut = !isPending && !session;
   const redirected = useRef(false);

   useEffect(() => {
      if (isPublic || !signedOut) {
         redirected.current = false;
         return;
      }
      if (redirected.current) return;
      redirected.current = true;
      void router.replace(loginPathFor(router.asPath));
   }, [isPublic, signedOut, router]);

   if (isPublic) return children;
   if (isPending || !session) return <FullPageSkeleton />;
   return children;
};

export default AuthGuard;
