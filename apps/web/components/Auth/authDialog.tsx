import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@barberflow/ui/components/dialog';

// Fields
import NameInput from '@barberflow/ui/components/auth/fields/name-input';
import EmailInput from '@barberflow/ui/components/auth/fields/email-input';
import OTPInput from '@barberflow/ui/components/auth/fields/otp-input';

// Buttons
import SubmitButton from '@barberflow/ui/components/auth/buttons/submit';
import GoogleButton from '@barberflow/ui/components/auth/buttons/google';

// Auth utils
import { useAuthStore } from '@barberflow/ui/lib/auth-store';

const AuthDialog = ({ children }: { children: React.ReactNode }) => {
  const { authType, toggleAuthType, otpSent: isVerificationStage, email, reset } = useAuthStore();

  const getDialogText = () => {
    if (isVerificationStage) {
      return {
        title: 'Verify your email',
        description: `We've sent a code to confirm your authentication attempt at ${email}`,
      };
    }

    return {
      title: authType === 'login' ? 'Login to your account' : 'Create your account',
      description: authType === 'login' ? 'Enter your details to login' : 'Enter your details to continue',
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
          {authType === 'login' ? "Don't have an account?" : 'Already have an account?'}
        </span>
        <button className="font-bold cursor-pointer" onClick={() => toggleAuthType()}>
          {authType === 'login' ? 'Sign up' : 'Sign in'}
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
            <img draggable={false} src="/logos/full.svg" alt="logo" className="h-7 w-auto select-none" />
          </DialogTitle>
          <DialogDescription className="flex items-center text-center gap-2 flex-col">
            <span className="text-black text-4xl font-semibold">{title}</span>
            <span className="text-base font-normal">{description}</span>
          </DialogDescription>
        </DialogHeader>
        <div className={isVerificationStage ? 'hidden' : 'flex flex-col gap-5'}>
          {authType === 'signup' && (
            <>
              <NameInput />
              <EmailInput />
              <div className="flex flex-col gap-3">
                <SubmitButton />
                <GoogleButton />
              </div>
            </>
          )}
          {authType === 'login' && (
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

export default AuthDialog;
