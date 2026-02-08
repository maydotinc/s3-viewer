import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
} from "@s3-viewer/ui/components/dialog";

import EmailInput from "./fields/email-input";
import NameInput from "./fields/name-input";
import OTPInput from "./fields/otp-input";

import GithubButton from "./buttons/github";
import SubmitButton from "./buttons/submit";

import { Button } from "@s3-viewer/ui/components/button";
import useAuthStore from "@/lib/stores/authStore";
import { MailCheck, UserRoundCheck, UserRoundPlus } from "lucide-react";
import { useEffect } from "react";

type AuthModalProps = {
   onClose: () => void;
};

const AuthModal: React.FC<AuthModalProps> = ({ onClose }) => {
   const {
      authType,
      toggleAuthType,
      otpSent: isVerificationStage,
      email,
      reset,
      error,
      setError,
   } = useAuthStore();

   useEffect(() => {
      setError(null);
   }, [authType]);

   const getDialogText = () => {
      if (isVerificationStage) {
         return {
            title: (
               <div className="flex flex-col gap-5 items-center">
                  <div className="bg-viewergray border border-xs rounded-2xl p-4">
                     <MailCheck className="size-7 text-viewerblue" />
                  </div>
                  <span>Verify your email</span>
               </div>
            ),
            description: `We've sent a code to confirm your authentication attempt at ${email}`,
         };
      }

      return {
         title:
            authType === "signin" ? (
               <div className="flex flex-col gap-5 items-center">
                  <div className="bg-viewergray border border-xs rounded-2xl p-4">
                     <UserRoundCheck className="size-7 text-viewerblue" />
                  </div>
                  <span>Log in to your account</span>
               </div>
            ) : (
               <div className="flex flex-col gap-5 items-center">
                  <div className="bg-viewergray border border-xs rounded-2xl p-4">
                     <UserRoundPlus className="size-7 text-viewerblue" />
                  </div>
                  <span>Create a new account</span>
               </div>
            ),
         description:
            authType === "signin"
               ? "Enter your details to recieve a verification code"
               : "Enter your details to continue",
      };
   };

   const { title, description } = getDialogText();

   const BottomText = () => {
      if (isVerificationStage) {
         return (
            <div className="flex items-center justify-center text-sm text-black">
               <span>Wrong email?</span>
               <Button
                  variant="link"
                  className="cursor-pointer px-1 text-blackhover:text-viewerblue"
                  onClick={() => reset()}
               >
                  Try again
               </Button>
            </div>
         );
      }

      return (
         <div className="flex items-center justify-center text-sm text-black">
            <span className="font-normal">
               {authType === "signin"
                  ? "Don't have an account?"
                  : "Already have an account?"}
            </span>
            <Button
               variant="link"
               className="cursor-pointer px-1 text-black hover:text-viewerblue"
               onClick={() => toggleAuthType()}
            >
               {authType === "signin" ? "Sign up" : "Sign in"}
            </Button>
         </div>
      );
   };

   return (
      <Dialog open={true} onOpenChange={onClose}>
         <DialogContent
            animate={false}
            className="max-w-[95%] xs:max-w-lg sm:max-w-md overflow-hidden pb-2 gap-2"
         >
            <DialogHeader className="flex flex-col items-center text-center gap-2">
               <DialogTitle>{title}</DialogTitle>
               <DialogDescription className="flex items-center text-center gap-2 flex-col">
                  <span>{description}</span>
               </DialogDescription>
            </DialogHeader>
            <div
               className={
                  isVerificationStage ? "hidden" : "flex flex-col w-full gap-4"
               }
            >
               {authType === "signup" && (
                  <>
                     <NameInput />
                     <EmailInput />
                     <SubmitButton />
                     <div className="flex items-center gap-2 w-full">
                        <div className="flex-1 h-[1px] bg-gray-300" />
                        <span className="text-sm text-gray-500">OR</span>
                        <div className="flex-1 h-[1px] bg-gray-300" />
                     </div>
                     <GithubButton />
                  </>
               )}
               {authType === "signin" && (
                  <>
                     <EmailInput />
                     <SubmitButton />
                     <div className="flex items-center gap-2 w-full">
                        <div className="flex-1 h-[1px] bg-gray-300" />
                        <span className="text-sm text-gray-500">OR</span>
                        <div className="flex-1 h-[1px] bg-gray-300" />
                     </div>
                     <GithubButton />
                  </>
               )}
            </div>
            {isVerificationStage && (
               <>
                  <OTPInput />
                  <SubmitButton />
               </>
            )}
            <div className="flex w-full h-[10px]">
               <span className="text-red-500 text-xs">{error}</span>
            </div>
            <DialogFooter className="flex justify-center">
               <BottomText />
            </DialogFooter>
         </DialogContent>
      </Dialog>
   );
};

export default AuthModal;
