import AuthScreen from "@/components/Auth/auth-screen";
import Seo from "@/components/seo";
import { getInstanceConfigProps as getServerSideProps } from "@/lib/instance-config-props";
import { PRODUCT_NAME, SITE_PATHS } from "@s3-viewer/shared";

const LoginPage = () => (
   <>
      <Seo
         title="Log in"
         description={`Log in to ${PRODUCT_NAME} with your email and password, or with GitHub.`}
         canonical={SITE_PATHS.login}
         noindex={false}
      />
      <AuthScreen mode="login" />
   </>
);

export default LoginPage;
export { getServerSideProps };
