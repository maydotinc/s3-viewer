import Verify from "@/components/Auth/form/verify";
import AuthLayout from "@/components/Layout/auth";
import Seo from "@/components/Seo";

const VerifyPage = () => {
   return (
      <>
         <Seo
            title="Verify"
            description="Verify your email address to continue to your S3 Viewer account."
            canonical="/verify"
            noindex={false}
         />
         <Verify />
      </>
   );
};

VerifyPage.getLayout = (page: React.ReactNode) => {
   return <AuthLayout>{page}</AuthLayout>;
};

export default VerifyPage;
