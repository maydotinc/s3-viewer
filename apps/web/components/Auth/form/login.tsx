import { useEffect } from "react";
import { useRouter } from "next/router";
import useAuthStore from "@/lib/stores/authStore";
import { isValidEmail } from "@s3-viewer/ui/lib/utils";
import AuthForm from "./auth-form";

const Login = () => {
   const router = useRouter();
   const { setAuthType, setEmail, setOtpSent } = useAuthStore();

   useEffect(() => {
      setAuthType("signin");

      const params = new URLSearchParams(window.location.search);
      const emailParam = params.get("email");
      const codeParam = params.get("code");

      if (emailParam && isValidEmail(emailParam)) {
         setEmail(emailParam);

         if (codeParam && /^\d{6}$/.test(codeParam)) {
            setOtpSent(true);
            router.replace(`/verify?code=${codeParam}`);
            return;
         }
      }
   }, []);

   return <AuthForm authType="signin" />;
};

export default Login;
