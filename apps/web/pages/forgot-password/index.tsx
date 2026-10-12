import ForgotPasswordScreen from "@/components/Auth/forgot-password-screen";
import Seo from "@/components/seo";
import { PRODUCT_NAME, SITE_PATHS } from "@s3-viewer/types";

const ForgotPasswordPage = () => (
   <>
      <Seo
         title="Reset your password"
         description={`Reset your ${PRODUCT_NAME} password with a link sent to your email.`}
         canonical={SITE_PATHS.forgotPassword}
      />
      <ForgotPasswordScreen />
   </>
);

export default ForgotPasswordPage;
