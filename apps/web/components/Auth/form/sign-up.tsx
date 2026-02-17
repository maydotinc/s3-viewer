import { useEffect } from "react";
import useAuthStore from "@/lib/stores/authStore";
import AuthForm from "./auth-form";

const SignUp = () => {
   const { setAuthType } = useAuthStore();

   useEffect(() => {
      setAuthType("signup");
   }, [setAuthType]);

   return <AuthForm />;
};

export default SignUp;
