import { sendVerificationEmail } from "@/lib/auth";
import { toast } from "@s3-viewer/ui/components/toast";
import { useMutation } from "@tanstack/react-query";

// one hook behind every "resend verification email" control
const useResendVerification = () =>
   useMutation<void, Error, string>({
      mutationFn: async (email) => {
         const { error } = await sendVerificationEmail(email);
         if (error) throw new Error(error);
      },
      onSuccess: () => {
         toast.success("Verification email sent", {
            description: "Open the link in it to verify your address.",
         });
      },
      onError: (error) => {
         toast.error("Couldn't send the email", { description: error.message });
      },
   });

export default useResendVerification;
