import { Button } from '@barberflow/ui/components/button';
import { signInWithGoogle } from '@barberflow/auth-config/client';
import { useAuthStore } from '@barberflow/ui/lib/auth-store';
import { GoogleIcon } from '@barberflow/ui/icons';

const SubmitButton = () => {
  const { authType } = useAuthStore();
  const buttonText = authType === 'login' ? 'Sign in' : 'Sign up';

  return (
    <div className="flex flex-col gap-0">
      <Button
        variant="outline"
        className="w-full rounded-[12px] flex items-center justify-center gap-2"
        onClick={signInWithGoogle}
      >
        <GoogleIcon />
        {buttonText} with Google
      </Button>
    </div>
  );
};

export default SubmitButton;
