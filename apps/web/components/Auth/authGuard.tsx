import { authClient } from "@s3-viewer/auth/client";
import { useRouter } from "next/router";
import { useEffect } from "react";

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
   const router = useRouter();
   const { data: session, isPending } = authClient.useSession();

   useEffect(() => {
      if (!isPending && !session && router.pathname !== "/auth") {
         router.push("/auth");
      }
   }, [session, isPending, router, router.pathname]);

   if (!session && router.pathname !== "/auth") {
      return null;
   }

   return <>{children}</>;
};

export default AuthGuard;
