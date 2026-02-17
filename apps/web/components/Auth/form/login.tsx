import { useEffect } from "react";
import useAuthStore from "@/lib/stores/authStore";
import AuthForm from "./auth-form";

const Login = () => {
   const { setAuthType } = useAuthStore();

   useEffect(() => {
      setAuthType("signin");
   }, [setAuthType]);

   return <AuthForm />;
};

export default Login;
