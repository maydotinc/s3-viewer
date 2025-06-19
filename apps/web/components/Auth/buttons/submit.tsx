import { Button } from '@barberflow/ui/components/button';
import { useAuthStore } from '@barberflow/ui/lib/auth-store';
import { sendVerificationOtp } from '@barberflow/auth-config/client';
import { isValidEmail } from '@barberflow/ui/lib/utils';
import { LoaderCircle } from 'lucide-react';

const SubmitButton = () => {
  const { name, email, authType, loading, setLoading, setOtpSent, invalidFields, setInvalidFields, verifying } =
    useAuthStore();
  const buttonText = authType === 'login' ? 'Sign in' : 'Sign up';

  const handleSubmit = async () => {
    setLoading(true);
    if (authType === 'signup') {
      if (!name) {
        setInvalidFields([...invalidFields, 'name']);
        setLoading(false);
        return;
      } else {
        setInvalidFields(invalidFields.filter((field) => field !== 'name'));
      }
    }
    if (!isValidEmail(email)) {
      setInvalidFields([...invalidFields, 'email']);
      setLoading(false);
      return;
    } else {
      setInvalidFields(invalidFields.filter((field) => field !== 'email'));
    }
    const { success, error } = await sendVerificationOtp(authType, email);
    if (error) {
      setLoading(false);
      return;
    }
    if (success) {
      setOtpSent(true);
      setLoading(false);
      return;
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-0">
      <Button
        disabled={loading || verifying}
        variant="barberflow-gradient"
        className="w-full rounded-[12px]"
        onClick={handleSubmit}
      >
        {loading || verifying ? <LoaderCircle className="animate-spin" /> : buttonText}
      </Button>
    </div>
  );
};

export default SubmitButton;
