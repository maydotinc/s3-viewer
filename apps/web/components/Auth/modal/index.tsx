import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@s3-viewer/ui/components/dialog";

import EmailField from "@/components/Auth/shared/email-field";
import NameField from "@/components/Auth/shared/name-field";
import OTPField from "@/components/Auth/shared/otp-field";
import GithubButton from "@/components/Auth/shared/github-button";
import SubmitButton from "@/components/Auth/shared/submit-button";

import { Button } from "@s3-viewer/ui/components/button";
import useAuthStore from "@/lib/stores/authStore";
import { MailCheck, UserRoundCheck, UserRoundPlus } from "lucide-react";
import { useEffect, useCallback } from "react";

import { useModalContext } from "@/lib/contexts/ModalContext";
import { authClient, verifyOtp, sendVerificationOtp, signInWithGithub } from "@s3-viewer/auth/client";
import { toast } from "@s3-viewer/ui/components/toast";
import { useRouter } from "next/router";

type AuthModalProps = {
  onClose: () => void;
};

const AuthModal: React.FC<AuthModalProps> = ({ onClose }) => {
  const router = useRouter();
  const { closeModal } = useModalContext();
  const { refetch: refetchSession } = authClient.useSession();

  const {
    authType,
    toggleAuthType,
    otpSent: isVerificationStage,
    email,
    name,
    reset,
    error,
    setError,
  } = useAuthStore();

  useEffect(() => {
    setError(null);
  }, [authType]);

  const handleSendOtp = useCallback(
    async (type: "signin" | "signup", emailAddr: string) => {
      return sendVerificationOtp(type, emailAddr);
    },
    []
  );

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
    refetchSession();
    closeModal("auth");
    await router.push("/dashboard");
  }, [refetchSession, closeModal, router]);

  const handleGithubClick = useCallback(async () => {
    const { success, error: githubError } = await signInWithGithub();
    if (githubError || !success) {
      toast.error("Failed to sign in with Github");
      console.error(githubError);
    }
  }, []);

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
              <NameField />
              <EmailField />
              <SubmitButton onSendOtp={handleSendOtp} />
              <div className="flex items-center gap-2 w-full">
                <div className="flex-1 h-[1px] bg-gray-300" />
                <span className="text-sm text-gray-500">OR</span>
                <div className="flex-1 h-[1px] bg-gray-300" />
              </div>
              <GithubButton onClick={handleGithubClick} />
            </>
          )}
          {authType === "signin" && (
            <>
              <EmailField />
              <SubmitButton onSendOtp={handleSendOtp} />
              <div className="flex items-center gap-2 w-full">
                <div className="flex-1 h-[1px] bg-gray-300" />
                <span className="text-sm text-gray-500">OR</span>
                <div className="flex-1 h-[1px] bg-gray-300" />
              </div>
              <GithubButton onClick={handleGithubClick} />
            </>
          )}
        </div>
        {isVerificationStage && (
          <>
            <OTPField onVerify={handleVerifyOtp} onVerified={handleVerified} />
            <SubmitButton onSendOtp={handleSendOtp} />
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
