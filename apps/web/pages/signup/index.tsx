import SignUp from "@/components/Auth/form/sign-up";
import AuthLayout from "@/components/Auth/form/auth-layout";

const SignUpPage = () => {
   return <SignUp />;
};

SignUpPage.getLayout = (page: React.ReactNode) => {
   return <AuthLayout>{page}</AuthLayout>;
};

export default SignUpPage;
