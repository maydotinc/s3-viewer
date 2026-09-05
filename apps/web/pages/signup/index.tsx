import AuthScreen from "@/components/Auth/auth-screen";
import Seo from "@/components/Seo";
import { SITE_PATHS } from "@s3-viewer/types";

const SignUpPage = () => (
   <>
      <Seo
         title="Create your account"
         description="Create an S3 Viewer account with your email and a password, or with GitHub."
         canonical={SITE_PATHS.signup}
         noindex={false}
      />
      <AuthScreen mode="signup" />
   </>
);

export default SignUpPage;
