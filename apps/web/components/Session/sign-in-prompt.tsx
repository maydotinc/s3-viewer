import { loginPathFor } from "@/lib/auth-redirect";
import { Button } from "@s3-viewer/ui/components/button";
import Link from "next/link";
import { useRouter } from "next/router";

const SignInPrompt = ({ children }: { children: string }) => {
   const router = useRouter();
   return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 pt-24 text-center">
         <p className="text-sm text-viewertext">{children}</p>
         <Button asChild variant="outline" size="sm">
            <Link href={loginPathFor(router.asPath)}>Sign in</Link>
         </Button>
      </div>
   );
};

export default SignInPrompt;
