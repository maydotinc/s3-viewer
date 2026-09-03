import AuthScreen from "@/components/Auth/auth-screen";
import Seo from "@/components/Seo";
import { SITE_PATHS } from "@s3-viewer/types";

const LoginPage = () => (
   <>
      <Seo
         title="Sign in"
         description="Sign in to S3 Viewer with a one-time code or a link sent to your email."
         canonical={SITE_PATHS.login}
         noindex={false}
      />
      <AuthScreen mode="login" />
   </>
);

export default LoginPage;
