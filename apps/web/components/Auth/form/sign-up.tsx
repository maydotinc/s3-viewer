import { useEffect } from "react";
import useAuthStore from "@/lib/stores/authStore";
import { isValidEmail } from "@s3-viewer/ui/lib/utils";
import AuthForm from "./auth-form";

const SignUp = () => {
   const { setAuthType, setEmail } = useAuthStore();

   useEffect(() => {
      setAuthType("signup");

      const params = new URLSearchParams(window.location.search);
      const emailParam = params.get("email");
      if (emailParam && isValidEmail(emailParam)) {
         setEmail(emailParam);
      }
   }, []);

   return <AuthForm authType="signup" />;
};

export default SignUp;
