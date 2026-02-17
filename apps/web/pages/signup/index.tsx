import SignUp from "@/components/Auth/form/sign-up";
import AuthLayout from "@/components/Layout/auth";
import Seo from "@/components/Seo";

const SignUpPage = () => {
   return (
      <>
         <Seo
            title="Sign Up"
            description="Create your S3 Viewer account to access your buckets."
            canonical="/signup"
            noindex={true}
         />
         <SignUp />
      </>
   );
};

SignUpPage.getLayout = (page: React.ReactNode) => {
   return <AuthLayout>{page}</AuthLayout>;
};

export default SignUpPage;
