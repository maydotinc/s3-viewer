import { sendVerificationOtp } from "@s3-viewer/auth/client";
import { Button } from "@s3-viewer/ui/components/button";
import { isValidEmail } from "@s3-viewer/ui/lib/utils";
import { LoaderCircle } from "lucide-react";
import useAuthStore from "../../../lib/authStore";

const SubmitButton = () => {
   const {
      name,
      email,
      authType,
      loading,
      setLoading,
      setOtpSent,
      invalidFields,
      setInvalidFields,
      verifying,
   } = useAuthStore();
   const buttonText = authType === "signin" ? "Sign in" : "Sign up";

   const handleSubmit = async () => {
      setLoading(true);
      if (authType === "signup") {
         if (!name) {
            setInvalidFields([...invalidFields, "name"]);
            setLoading(false);
            return;
         } else {
            setInvalidFields(invalidFields.filter((field) => field !== "name"));
         }
      }
      if (!isValidEmail(email)) {
         setInvalidFields([...invalidFields, "email"]);
         setLoading(false);
         return;
      } else {
         setInvalidFields(invalidFields.filter((field) => field !== "email"));
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
         <Button disabled={loading || verifying} className="w-full" onClick={handleSubmit}>
            {loading || verifying ? <LoaderCircle className="animate-spin" /> : buttonText}
         </Button>
      </div>
   );
};

export default SubmitButton;
