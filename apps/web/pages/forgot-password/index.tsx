import ForgotPasswordScreen from "@/components/Auth/forgot-password-screen";
import Seo from "@/components/Seo";
import { SITE_PATHS } from "@s3-viewer/types";

const ForgotPasswordPage = () => (
   <>
      <Seo
         title="Reset your password"
         description="Reset your S3 Viewer password with a code sent to your email."
         canonical={SITE_PATHS.forgotPassword}
      />
      <ForgotPasswordScreen />
   </>
);

export default ForgotPasswordPage;
