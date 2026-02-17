import useAuthStore from "@/lib/stores/authStore";
import { Button } from "@s3-viewer/ui/components/button";
import { isValidEmail } from "@s3-viewer/ui/lib/utils";
import { LoaderCircle } from "lucide-react";

interface SubmitButtonProps {
   authType?: "signin" | "signup";
   onSendOtp: (
      authType: "signin" | "signup",
      email: string
   ) => Promise<{ success?: boolean; error?: string | null }>;
   onOtpSent?: () => void;
}

const SubmitButton = ({
   authType: authTypeOverride,
   onSendOtp,
   onOtpSent,
}: SubmitButtonProps) => {
   const {
      name,
      email,
      authType,
      loading,
      setLoading,
      setOtpSent,
      otpSent,
      invalidFields,
      setInvalidFields,
      verifying,
      setError,
   } = useAuthStore();
   const effectiveAuthType = authTypeOverride ?? authType;

   const buttonText = otpSent
      ? "Verify"
      : effectiveAuthType === "signin"
        ? "Send Code"
        : "Register";

   const handleSubmit = async () => {
      setLoading(true);
      if (effectiveAuthType === "signup") {
         if (!name) {
            setInvalidFields([...invalidFields, "name"]);
            setError("Name is required");
            setLoading(false);
            return;
         } else {
            setInvalidFields(invalidFields.filter((field) => field !== "name"));
         }
      }
      if (!isValidEmail(email)) {
         setInvalidFields([...invalidFields, "email"]);
         setError("Invalid email");
         setLoading(false);
         return;
      } else {
         setInvalidFields(invalidFields.filter((field) => field !== "email"));
      }
      const { success, error } = await onSendOtp(effectiveAuthType, email);
      if (error) {
         setError(error);
         setLoading(false);
         return;
      }
      if (success) {
         setOtpSent(true);
         setLoading(false);
         setError(null);
         onOtpSent?.();
         return;
      }
      setLoading(false);
   };

   return (
      <Button
         disabled={loading || verifying}
         className="w-full"
         variant="secondary"
         onClick={handleSubmit}
      >
         {loading || verifying ? (
            <LoaderCircle className="animate-spin" />
         ) : (
            buttonText
         )}
      </Button>
   );
};

export default SubmitButton;
