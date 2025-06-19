import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogHeader,
   DialogTitle,
   DialogTrigger,
} from "@s3-viewer/ui/components/dialog";

// Fields
import EmailInput from "./fields/email-input";
import NameInput from "./fields/name-input";
import OTPInput from "./fields/otp-input";

// Buttons
import GoogleButton from "./buttons/google";
import SubmitButton from "./buttons/submit";

// Auth utils
import useAuthStore from "../../../lib/authStore";

const AuthModal = ({ children }: { children: React.ReactNode }) => {
   const { authType, toggleAuthType, otpSent: isVerificationStage, email, reset } = useAuthStore();

   const getDialogText = () => {
      if (isVerificationStage) {
         return {
            title: "Verify your email",
            description: `We've sent a code to confirm your authentication attempt at ${email}`,
         };
      }

      return {
         title: authType === "signin" ? "Login to your account" : "Create your account",
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
      <Dialog>
         <DialogTrigger asChild>{children}</DialogTrigger>
         <DialogContent className="max-w-[95%] xs:max-w-lg sm:max-w-md overflow-hidden min-h-[380px]">
            <DialogHeader className="mt-6 flex flex-col items-center text-center gap-5">
               <DialogTitle>
                  <img
                     draggable={false}
                     src="/logos/full.svg"
                     alt="logo"
                     className="h-7 w-auto select-none"
                  />
               </DialogTitle>
               <DialogDescription className="flex items-center text-center gap-2 flex-col">
                  <span className="text-black text-4xl font-semibold">{title}</span>
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
