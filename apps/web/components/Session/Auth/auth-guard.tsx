import { useModalContext } from "@/lib/contexts/ModalContext";
import { authClient } from "@s3-viewer/auth/client";
import { useRouter } from "next/router";
import { useEffect } from "react";

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
   const router = useRouter();
   const { data: session, isPending } = authClient.useSession();
   const { openAuthModal } = useModalContext();

   useEffect(() => {
      if (!isPending && !session) {
         openAuthModal();
      }
   }, [session, isPending, router.pathname]);
   return <>{children}</>;
};

export default AuthGuard;
