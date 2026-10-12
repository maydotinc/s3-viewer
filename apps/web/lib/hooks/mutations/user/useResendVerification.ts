import { sendVerificationEmail } from "@/lib/auth";
import useApiMutation from "@/lib/hooks/mutations/useApiMutation";
import { toast } from "@s3-viewer/ui/components/toast";

const useResendVerification = () =>
   useApiMutation<void, Error, string>({
      request: async (email) => {
         const { error } = await sendVerificationEmail(email);
         if (error) throw new Error(error);
      },
      success: () =>
         toast.success("Verification email sent", {
            description: "Open the link in it to verify your address.",
         }),
      failure: "Couldn't send the email",
   });

export default useResendVerification;
