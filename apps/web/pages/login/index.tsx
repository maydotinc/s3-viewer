import Login from "@/components/Auth/form/login";
import AuthLayout from "@/components/Auth/form/auth-layout";

const LoginPage = () => {
   return <Login />;
};

LoginPage.getLayout = (page: React.ReactNode) => {
   return <AuthLayout>{page}</AuthLayout>;
};

export default LoginPage;
