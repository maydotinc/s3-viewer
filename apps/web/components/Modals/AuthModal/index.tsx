import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
} from "@s3-viewer/ui/components/dialog";

// Fields
import EmailInput from "./fields/email-input";
import NameInput from "./fields/name-input";
import OTPInput from "./fields/otp-input";

// Buttons
import SubmitButton from "./buttons/submit";

// Auth utils
import useAuthStore from "@/lib/authStore";
import { Button } from "@s3-viewer/ui/components/button";
import { UserRoundPlus } from "lucide-react";
import TermsButton from "./buttons/terms";

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
         title:
            authType === "signin" ? (
               "Login to your account"
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
         <div className="flex items-center justify-center text-sm">
            <span className="font-normal">
               {authType === "signin" ? "Don't have an account?" : "Already have an account?"}
            </span>
            <Button
               variant="link"
               className="cursor-pointer px-1 hover:text-viewerblue"
               onClick={() => toggleAuthType()}
            >
               {authType === "signin" ? "Sign up" : "Sign in"}
            </Button>
         </div>
      );
   };

   return (
      <Dialog open={true} onOpenChange={onClose}>
         <DialogContent className="max-w-[95%] xs:max-w-lg sm:max-w-md overflow-hidden min-h-[380px]">
            <DialogHeader className="flex flex-col items-center text-center gap-2">
               <DialogTitle>{title}</DialogTitle>
               <DialogDescription className="flex items-center text-center gap-2 flex-col">
                  <span>{description}</span>
               </DialogDescription>
            </DialogHeader>
            <div className={isVerificationStage ? "hidden" : "flex flex-col gap-4"}>
               {authType === "signup" && (
                  <>
                     <NameInput />
                     <EmailInput />
                     <div className="flex flex-col gap-5">
                        <TermsButton />
                        <SubmitButton />
                        {/* <GoogleButton /> */}
                     </div>
                  </>
               )}
               {authType === "signin" && (
                  <>
                     <EmailInput />
                     <div className="flex flex-col gap-3">
                        <SubmitButton />
                        {/* <GoogleButton /> */}
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
            <DialogFooter className="flex justify-center">
               <BottomText />
            </DialogFooter>
         </DialogContent>
      </Dialog>
   );
};

export default AuthModal;
