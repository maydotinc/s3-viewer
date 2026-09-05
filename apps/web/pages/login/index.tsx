import AuthScreen from "@/components/Auth/auth-screen";
import Seo from "@/components/Seo";
import { SITE_PATHS } from "@s3-viewer/types";

const LoginPage = () => (
   <>
      <Seo
         title="Log in"
         description="Log in to S3 Viewer with your email and password, or with GitHub."
         canonical={SITE_PATHS.login}
         noindex={false}
      />
      <AuthScreen mode="login" />
   </>
);

export default LoginPage;
