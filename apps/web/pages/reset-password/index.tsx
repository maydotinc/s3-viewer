import ResetPasswordScreen from "@/components/Auth/reset-password-screen";
import Seo from "@/components/Seo";
import { SITE_PATHS } from "@s3-viewer/types";

const ResetPasswordPage = () => (
   <>
      <Seo
         title="Choose a new password"
         description="Choose a new password for your S3 Viewer account."
         canonical={SITE_PATHS.resetPassword}
      />
      <ResetPasswordScreen />
   </>
);

export default ResetPasswordPage;
