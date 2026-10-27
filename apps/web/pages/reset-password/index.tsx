import ResetPasswordScreen from "@/components/Auth/reset-password-screen";
import Seo from "@/components/seo";
import { PRODUCT_NAME, SITE_PATHS } from "@s3-viewer/shared";

const ResetPasswordPage = () => (
   <>
      <Seo
         title="Choose a new password"
         description={`Choose a new password for your ${PRODUCT_NAME} account.`}
         canonical={SITE_PATHS.resetPassword}
      />
      <ResetPasswordScreen />
   </>
);

export default ResetPasswordPage;
