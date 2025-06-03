import { useSession } from "@s3-viewer/auth/client";
import { useRouter } from "next/router";
import { useEffect } from "react";

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
    const router = useRouter();
    const { data: session, isPending } = useSession();

    useEffect(() => {
        if (!isPending && !session && router.pathname !== '/connect') {
            router.push("/connect");
        }
    }, [session, isPending, router, router.pathname]);

    if (!session && router.pathname !== '/connect') {
        return null;
    }
    
    return <>{children}</>
}

export default AuthGuard;
