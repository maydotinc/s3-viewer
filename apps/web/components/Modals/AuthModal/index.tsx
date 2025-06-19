import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogHeader,
   DialogTitle,
} from "@s3-viewer/ui/components/dialog";

// Fields
import EmailInput from "./fields/email-input";
import NameInput from "./fields/name-input";
import OTPInput from "./fields/otp-input";

// Buttons
import GoogleButton from "./buttons/google";
import SubmitButton from "./buttons/submit";

// Auth utils
import useAuthStore from "@/lib/authStore";
import { UserRoundPlus } from "lucide-react";

type AuthModalProps = {
   onClose: () => void;
};

const AuthModal = ({ onClose }: AuthModalProps) => {
   const { authType, toggleAuthType, otpSent: isVerificationStage, email, reset } = useAuthStore();

   const getDialogText = () => {
      if (isVerificationStage) {
         return {
            title: "Verify your email",
            description: `We've sent a code to confirm your authentication attempt at ${email}`,
         };
      }

      return {
         title: authType === "signin" ? "Login to your account" : "Create a new account",
         description:
            authType === "signin"
               ? "Enter your details to login"
               : "Enter your details to continue",
      };
   };

   const { title, description } = getDialogText();

   const BottomText = () => {
      if (isVerificationStage) {
         return (
            <div className="flex items-center justify-center gap-1 text-sm">
               <span className="font-normal">Wrong email?</span>
               <button className="font-bold cursor-pointer" onClick={() => reset()}>
                  Try again
               </button>
            </div>
         );
      }

      return (
         <div className="flex items-center justify-center gap-1 text-sm">
            <span className="font-normal">
               {authType === "signin" ? "Don't have an account?" : "Already have an account?"}
            </span>
            <button className="font-bold cursor-pointer" onClick={() => toggleAuthType()}>
               {authType === "signin" ? "Sign up" : "Sign in"}
            </button>
         </div>
      );
   };

   return (
      <Dialog open={true} onOpenChange={onClose}>
         <DialogContent className="max-w-[95%] xs:max-w-lg sm:max-w-md overflow-hidden min-h-[380px]">
            <DialogHeader className="flex flex-col items-center text-center gap-2">
               <div className="bg-viewergray border border-viewerborder rounded-2xl p-2">
                  <UserRoundPlus className="size-10 text-viewerblue" />
               </div>
               <DialogTitle>{title}</DialogTitle>
               <DialogDescription className="flex items-center text-center gap-2 flex-col">
                  <span className="text-base font-normal">{description}</span>
               </DialogDescription>
            </DialogHeader>
            <div className={isVerificationStage ? "hidden" : "flex flex-col gap-5"}>
               {authType === "signup" && (
                  <>
                     <NameInput />
                     <EmailInput />
                     <div className="flex flex-col gap-3">
                        <SubmitButton />
                        <GoogleButton />
                     </div>
                  </>
               )}
               {authType === "signin" && (
                  <>
                     <EmailInput />
                     <div className="flex flex-col gap-3">
                        <SubmitButton />
                        <GoogleButton />
                     </div>
                  </>
               )}
            </div>
            {isVerificationStage && (
               <>
                  <OTPInput />
                  <SubmitButton />
               </>
            )}
            <BottomText />
         </DialogContent>
      </Dialog>
   );
};

export default AuthModal;
