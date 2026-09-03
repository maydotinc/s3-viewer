import AuthScreen from "@/components/Auth/auth-screen";
import Seo from "@/components/Seo";
import { SITE_PATHS, emailSchema } from "@s3-viewer/types";
import { useRouter } from "next/router";
import { useEffect } from "react";

const VerifyPage = () => {
   const router = useRouter();
   const parsed = emailSchema.safeParse(router.query.email);
   const email = parsed.success ? parsed.data : null;

   useEffect(() => {
      if (router.isReady && !email) void router.replace(SITE_PATHS.login);
   }, [router, email]);

   if (!email) return null;

   return (
      <>
         <Seo
            title="Enter your code"
            description="Enter the code we emailed you to finish signing in to S3 Viewer."
            canonical={SITE_PATHS.verify}
         />
         <AuthScreen mode="login" initialEmail={email} />
      </>
   );
};

export default VerifyPage;
