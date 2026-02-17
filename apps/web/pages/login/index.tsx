import Login from "@/components/Auth/form/login";
import AuthLayout from "@/components/Layout/auth";
import Seo from "@/components/Seo";

const LoginPage = () => {
   return (
      <>
         <Seo
            title="Login"
            description="Log in to your S3 Viewer account."
            canonical="/login"
            noindex={false}
         />
         <Login />
      </>
   );
};

LoginPage.getLayout = (page: React.ReactNode) => {
   return <AuthLayout>{page}</AuthLayout>;
};

export default LoginPage;
