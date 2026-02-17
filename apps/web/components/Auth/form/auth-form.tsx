import useAuthStore from "@/lib/stores/authStore";
import EmailField from "@/components/Auth/shared/email-field";
import NameField from "@/components/Auth/shared/name-field";
import SubmitButton from "@/components/Auth/shared/submit-button";
import GithubButton from "@/components/Auth/shared/github-button";
import { cn } from "@s3-viewer/ui/lib/utils";
import { sendVerificationOtp, signInWithGithub } from "@s3-viewer/auth/client";
import { toast } from "@s3-viewer/ui/components/toast";
import { UserRoundCheck, UserRoundPlus } from "lucide-react";
import { useRouter } from "next/router";
import { useCallback } from "react";

type AuthFormProps = {
   className?: string;
};

const AuthForm = ({ className }: AuthFormProps) => {
   const router = useRouter();
   const { authType, error } = useAuthStore();

   const headingText =
      authType === "signin" ? "Log in to your account" : "Create a new account";
   const descriptionText =
      authType === "signin"
         ? "Enter your details to recieve a verification code"
         : "Enter your details to continue";

   const handleSendOtp = useCallback(
      async (type: "signin" | "signup", email: string) => {
         return sendVerificationOtp(type, email);
      },
      []
   );

   const handleOtpSent = useCallback(() => {
      router.push("/verify");
   }, [router]);

   const handleGithubClick = useCallback(async () => {
      const { success, error: githubError } = await signInWithGithub();
      if (githubError || !success) {
         toast.error("Failed to sign in with Github");
         console.error(githubError);
      }
   }, []);

   return (
      <div className={cn("w-full max-w-md space-y-4 sm:space-y-6", className)}>
         <div className="flex flex-col items-center gap-5 text-center">
            <div className="bg-viewergray border border-xs rounded-2xl p-4">
               {authType === "signup" ? (
                  <UserRoundPlus className="size-7 text-viewerblue" />
               ) : (
                  <UserRoundCheck className="size-7 text-viewerblue" />
               )}
            </div>
            <div className="space-y-1">
               <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl">
                  {headingText}
               </h1>
               <p className="text-sm text-gray-600">{descriptionText}</p>
            </div>
         </div>

         <div className="flex flex-col w-full gap-4">
            {authType === "signup" && <NameField />}
            <EmailField />
            <SubmitButton onSendOtp={handleSendOtp} onOtpSent={handleOtpSent} />
            <div className="flex items-center gap-2 w-full">
               <div className="flex-1 h-[1px] bg-gray-300" />
               <span className="text-sm text-gray-500">OR</span>
               <div className="flex-1 h-[1px] bg-gray-300" />
            </div>
            <GithubButton onClick={handleGithubClick} />
         </div>

         {error && (
            <div className="flex w-full">
               <span className="text-red-500 text-xs">{error}</span>
            </div>
         )}
      </div>
   );
};

export default AuthForm;
