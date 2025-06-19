import { toast } from "@s3-viewer/ui/components/toast";
import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const baseURL = process.env.AUTH_SERVER_URL || "http://localhost:5001";

const authClient = createAuthClient({
   baseURL: baseURL,
   basePath: "/auth",
   fetchOptions: {
      credentials: "include",
   },
   plugins: [emailOTPClient()],
});

const doesUserExist = async (email: string) => {
   try {
      const res = await fetch(`${baseURL}/user/does-user-exist`, {
         method: "POST",
         headers: {
            "Content-Type": "application/json",
         },
         body: JSON.stringify({ email }),
      });
      if (res.status === 200) {
         const data = await res.json();
         return { success: true, exists: data.exists, error: null };
      }
      return { success: false, exists: null, error: "Something went wrong" };
   } catch (error) {
      console.error("Error checking user existence:", error);
      return { success: false, exists: null, error: "Something went wrong" };
   }
};

const signOut = async () => {
   const { data, error } = await authClient.signOut({
      fetchOptions: {
         onSuccess: () => {
            window.location.href = "/";
         },
      },
   });
   if (error) {
      toast.error(error.message ?? error.statusText);
      return { success: false, data: null, error: error.message ?? error.statusText };
   }
   return { success: true, data, error: null };
};

const sendVerificationOtp = async (type: "signin" | "signup", email: string) => {
   const { exists, error } = await doesUserExist(email);

   if (error) {
      toast.error(error);
      return { success: false, error: error };
   }

   if (type === "signup") {
      if (exists) {
         toast.error("User already exists");
         return { success: false, error: "User already exists" };
      }
   } else {
      if (!exists) {
         toast.error("User does not exist, please sign up");
         return { success: false, error: "User does not exist" };
      }
   }

   const { data, error: otpError } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "sign-in",
   });
   if (otpError) {
      toast.error(otpError.message ?? otpError.statusText);
      return { success: false, error: otpError.message ?? otpError.statusText };
   }
   return { success: true, data, error: null };
};

const verifyOtp = async (email: string, otp: string, successUrl: string) => {
   const { data, error } = await authClient.signIn.emailOtp({
      email,
      otp,
      fetchOptions: {
         onSuccess: () => {
            window.location.href = successUrl;
         },
      },
   });
   if (error) {
      console.dir(error, { depth: null });
      toast.error(error.message ?? error.statusText);
      return { success: false, data: null, error: error.message ?? error.statusText };
   }
   return { success: true, data, error: null };
};

export { authClient, sendVerificationOtp, signOut, verifyOtp };
