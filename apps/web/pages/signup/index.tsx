import AuthScreen from "@/components/Auth/auth-screen";
import Seo from "@/components/seo";
import { getInstanceConfigProps as getServerSideProps } from "@/lib/instance-config-props";
import { PRODUCT_NAME, SITE_PATHS } from "@s3-viewer/types";

const SignUpPage = () => (
   <>
      <Seo
         title="Create your account"
         description={`Create an ${PRODUCT_NAME} account with your email and a password, or with GitHub.`}
         canonical={SITE_PATHS.signup}
         noindex={false}
      />
      <AuthScreen mode="signup" />
   </>
);

export default SignUpPage;
export { getServerSideProps };
