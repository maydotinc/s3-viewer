import useAuthStore from "@/lib/stores/authStore";
import { sendVerificationOtp } from "@s3-viewer/auth/client";
import { Button } from "@s3-viewer/ui/components/button";
import { isValidEmail } from "@s3-viewer/ui/lib/utils";
import { LoaderCircle } from "lucide-react";

const SubmitButton = () => {
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
   const buttonText = otpSent
      ? "Verify"
      : authType === "signin"
        ? "Send Code"
        : "Register";

   const handleSubmit = async () => {
      setLoading(true);
      if (authType === "signup") {
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
      const { success, error } = await sendVerificationOtp(authType, email);
      if (error) {
         setError(error);
         setLoading(false);
         return;
      }
      if (success) {
         setOtpSent(true);
         setLoading(false);
         setError(null);
         return;
      }
      setLoading(false);
   };

   return (
      <div className="flex flex-col gap-0">
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
      </div>
   );
};

export default SubmitButton;
