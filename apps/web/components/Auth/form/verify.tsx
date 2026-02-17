import useAuthStore from "@/lib/stores/authStore";
import OTPField from "@/components/Auth/shared/otp-field";
import SubmitButton from "@/components/Auth/shared/submit-button";
import { Button } from "@s3-viewer/ui/components/button";
import { authClient, verifyOtp, sendVerificationOtp } from "@s3-viewer/auth/client";
import { MailCheck } from "lucide-react";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo } from "react";

const Verify = () => {
   const router = useRouter();
   const {
      email,
      name,
      authType,
      otpSent,
      error,
      reset,
   } = useAuthStore();

   const initialCode = useMemo(() => {
      if (typeof window === "undefined") return undefined;
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      return code && /^\d{6}$/.test(code) ? code : undefined;
   }, []);

   useEffect(() => {
      if (!otpSent || !email) {
         router.replace("/login");
      }
   }, [otpSent, email, router]);

   const handleVerifyOtp = useCallback(
      async (emailAddr: string, code: string) => {
         const { error: verifyError } = await verifyOtp(emailAddr, code);
         if (verifyError) return { error: verifyError };

         if (authType === "signup") {
            const { error: updateError } = await authClient.updateUser({ name });
            if (updateError) {
               return { error: updateError.message ?? updateError.statusText };
            }
         }
         return { error: null };
      },
      [authType, name]
   );

   const handleVerified = useCallback(async () => {
      window.location.href = "/dashboard";
   }, []);

   const handleSendOtp = useCallback(
      async (type: "signin" | "signup", emailAddr: string) => {
         return sendVerificationOtp(type, emailAddr);
      },
      []
   );

   const handleReset = useCallback(() => {
      reset();
      router.push("/login");
   }, [reset, router]);

   if (!otpSent || !email) return null;

   return (
      <div className="w-full max-w-md space-y-4 sm:space-y-6">
         <div className="flex flex-col items-center gap-5 text-center">
            <div className="bg-viewergray border border-xs rounded-2xl p-4">
               <MailCheck className="size-7 text-viewerblue" />
            </div>
            <div className="space-y-1">
               <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl">
                  Verify your email
               </h1>
               <p className="text-sm text-gray-600">
                  We&apos;ve sent a code to confirm your authentication attempt at{" "}
                  <span className="font-medium">{email}</span>
               </p>
            </div>
         </div>

         <OTPField initialCode={initialCode} onVerify={handleVerifyOtp} onVerified={handleVerified} />
         <SubmitButton onSendOtp={handleSendOtp} />

         {error && (
            <div className="flex w-full">
               <span className="text-red-500 text-xs">{error}</span>
            </div>
         )}

         <div className="flex items-center justify-center text-sm text-black">
            <span>Wrong email?</span>
            <Button
               variant="link"
               className="cursor-pointer px-1 text-black hover:text-viewerblue"
               onClick={handleReset}
            >
               Try again
            </Button>
         </div>
      </div>
   );
};

export default Verify;
