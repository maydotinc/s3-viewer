import Verify from "@/components/Auth/form/verify";
import AuthLayout from "@/components/Auth/form/auth-layout";

const VerifyPage = () => {
   return <Verify />;
};

VerifyPage.getLayout = (page: React.ReactNode) => {
   return <AuthLayout>{page}</AuthLayout>;
};

export default VerifyPage;
